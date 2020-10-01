const {Settings} = require('./settings');
const {Track} = require('./definitions');
const decryptor = require('nodeezcryptor');
const fs = require('fs');
const path = require('path');
const logger = require('./winston');
const https = require('https');
const Datastore = require('nedb');
const ID3Writer = require('browser-id3-writer');
const Metaflac = require('metaflac-js2');
const sanitize = require("sanitize-filename");
const { DeezerAPI } = require('./deezer');

class Downloads {
    constructor(settings, qucb) {
        this.downloads = [];
        this.downloading = false;
        this.download;

        this.settings = settings;
        //Queue update callback
        this.qucb = qucb;
    }

    //Add track to queue
    async add(track, quality = null) {
        if (this.downloads.filter((e => e.id == track.id)).length > 0) {
            //Track already in queue
            return;
        }

        //Sanitize quality
        let q = this.settings.downloadsQuality;
        if (quality) q = parseInt(quality.toString(), 10);

        //Create download
        let outpath = this.generateTrackPath(track, q); 
        let d = new Download(
            track, 
            outpath, 
            q, 
            () => {this._downloadDone();}
        );
        this.downloads.push(d);

        //Update callback
        if (this.qucb) this.qucb();

        //Save to DB
        await new Promise((res, rej) => {
            this.db.insert(d.toDB(), (e) => {
                res();
            });
        });
    }

    generateTrackPath(track, quality) {
        //Generate filename
        let fn = this.settings.downloadFilename;
        
        //Disable feats for single artist
        let feats = '';
        if (track.artists.length >= 2) feats = track.artists.slice(1).map((a) => a.name).join(', ');
        
        let props = {
            '%title%': track.title,
            '%artists%': track.artistString,
            '%artist%': track.artists[0].name,
            '%feats%': feats,
            '%trackNumber%': (track.trackNumber ? track.trackNumber : 1).toString(),
            '%0trackNumber%': (track.trackNumber ? track.trackNumber : 1).toString().padStart(2, '0'),
            '%album%': track.album.title
        };
        for (let k of Object.keys(props)) {
            fn = fn.replace(new RegExp(k, 'g'), sanitize(props[k]));
        }
        //Generate folders
        let p = this.settings.downloadsPath;
        if (this.settings.createArtistFolder) p = path.join(p, sanitize(track.artists[0].name));
        if (this.settings.createAlbumFolder) p = path.join(p, sanitize(track.album.title));

        return path.join(p, fn);
    }

    async start() {
        //Already downloading
        if (this.download || this.downloads.length == 0) return;
        
        this.downloading = true;
        await this._downloadDone();
    }

    async stop() {
        //Not downloading
        if (!this.download || !this.downloading) return;
        this.downloading = false;
        await this.download.stop();

        //Back to queue if undone
        if (this.download.state < 3) this.downloads.unshift(this.download);
        
        this.download = null;

        //Update callback
        if (this.qucb) this.qucb();
    }

    //On download finished
    async _downloadDone() {
        //Save to DB
        if (this.download) {
            await new Promise((res, rej) => {
                this.db.update({_id: this.download.id}, {
                    state: this.download.state,
                    fallback: this.download.fallback,
                }, (e) => {
                    res();
                });
                // this.db.remove({_id: this.download.id}, (e) => {
                //     res();
                // });
            });
        }

        this.download = null;

        //All downloads done
        if (this.downloads.length == 0 || this.downloading == false) {
            this.downloading = false;
            if (this.qucb) this.qucb();
            return;
        }

        this.download = this.downloads[0];
        this.downloads = this.downloads.slice(1);
        this.download.start();

        //Update callback
        if (this.qucb) this.qucb();
    }

    //Load downloads info
    async load() {
        this.db = new Datastore({filename: Settings.getDownloadsDB(), autoload: true});
        //Load downloads
        await new Promise((res, rej) => {
            this.db.find({}, (err, docs) => {
                if (err) return rej();
                if (!docs) return;

                for (let d of docs) {
                    if (d.state < 3 && d.state >= 0) this.downloads.push(Download.fromDB(d, () => {this._downloadDone();}));
                    //TODO: Ignore for now completed
                }
                res();
            });
        });

        //Create temp dir
        if (!fs.existsSync(Settings.getTempDownloads())) {
            fs.promises.mkdir(Settings.getTempDownloads(), {recursive: true});
        }
    }

    //Remove download
    async delete(index) {
        //Clear all
        if (index == -1) {
            this.downloads = [];
            await new Promise((res, rej) => {
                this.db.remove({state: 0}, {multi: true}, (e) => {});
                res();
            });

            if (this.qucb) this.qucb();
            return;
        }

        //Remove single
        if (index >= this.downloads.length) return;
        await new Promise((res, rej) => {
            this.db.remove({_id: this.downloads[index].id}, {}, (e) => {});
            res();
        });
        this.downloads.splice(index, 1);

        if (this.qucb) this.qucb();
    }
}

class Download {
    constructor(track, path, quality, onDone) {
        this.track = track;
        this.id = track.id;
        this.path = path;
        this.quality = quality;
        this.onDone = onDone;

        //States:
        //0 - none/stopped
        //1 - downloading
        //2 - post-processing
        //3 - done
        //-1 - download error
        this.state = 0;
        this.fallback = false;

        this._request;
        //Post Processing Promise
        this._ppp;

        this.downloaded = 0;
        this.size = 0;
    }

    //Serialize to database json
    toDB() {
        return {
            _id: this.id,
            path: this.path,
            quality: this.quality,
            track: this.track,
            state: this.state,
            fallback: this.fallback
        }
        
    }

    //Create download from DB document
    static fromDB(doc, onDone) {
        let d = new Download(doc.track, doc.path, doc.quality, onDone);
        d.fallback = doc.fallback ? true : false; //Null check
        d.state = doc.state;
        return d;
    }

    async start() {
        this.state = 1;

        //Path to temp file
        let tmp = path.join(Settings.getTempDownloads(), `${this.track.id}.ENC`);
        //Get start offset
        let start = 0;
        try {
            let stat = await fs.promises.stat(tmp);
            if (stat.size) start = stat.size;
        } catch (e) {}
        this.downloaded = start;

        //Get download info
        let streamInfo = Track.getUrlInfo(this.track.streamUrl);
        this.url = DeezerAPI.getUrl(streamInfo.trackId, streamInfo.md5origin, streamInfo.mediaVersion, this.quality);
        this._request = https.get(this.url, {headers: {'Range': `bytes=${start}-`}}, (r) => {
            let outFile = fs.createWriteStream(tmp, {flags: 'a'});
            let skip = false;
            //Error
            if (r.statusCode >= 400) {
                //Fallback on error
                if (this.quality > 1) {
                    if (this.quality == 3) this.quality = 1;
                    if (this.quality == 9) this.quality = 3;
                    this.url = null;
                    this.fallback = true;
                    return this.start();
                };
                //Error
                this.state = -1;
                logger.error(`Undownloadable track ID: ${this.track.id}`);
                return this.onDone();
            } else {
                this.path += (this.quality == 9) ? '.flac' : '.mp3';
                
                //Check if file exits
                fs.access(this.path, (err) => {
                    if (err) {

                    } else {
                        logger.warn('File already exists! Skipping...');
                        outFile.close();
                        skip = true;
                        this._request.end();
                        this.state = 3;
                        return this.onDone();
                    }
                    
                })
            }

            //On download done
            r.on('end', () => {
                if (skip) return;
                if (this.downloaded != this.size) return;

                outFile.close(() => {
                    this._finished(tmp);
                });
            });
            //Progress
            r.on('data', (c) => {
                outFile.write(c);
                this.downloaded += c.length;
            });

            r.on('error', (e) => {
                logger.error(`Download error: ${e}`);
                //TODO: Download error handling
            })

            //Save size
            this.size = parseInt(r.headers['content-length'], 10) + start;
            
        });
    }

    //Stop current request
    async stop() {
        this._request.destroy();
        this._request = null;
        this.state = 0;
        if (this._ppp) await this._ppp;
    }

    async _finished(tmp) {
        this.state = 2;
        
        //Create post processing promise
        let resolve;
        this._ppp = new Promise((res, rej) => {
            resolve = res;
        });

        //Prepare output directory
        try {
            await fs.promises.mkdir(path.dirname(this.path), {recursive: true})
        } catch (e) {};

        //Decrypt
        //this.path += (this.quality == 9) ? '.flac' : '.mp3';
        decryptor.decryptFile(decryptor.getKey(this.track.id), tmp, `${tmp}.DEC`);
        await fs.promises.copyFile(`${tmp}.DEC`, this.path);
        //Delete encrypted
        await fs.promises.unlink(tmp);
        await fs.promises.unlink(`${tmp}.DEC`);

        //Tags
        await this.tagAudio(this.path, this.track);

        //Finish
        this.state = 3;
        resolve();
        this._ppp = null;
        this.onDone();
    }

    //Download cover to buffer
    async downloadCover(url) {
        return await new Promise((res, rej) => {
            let out = Buffer.alloc(0);
            https.get(url, (r) => {
                r.on('data', (d) => {
                    out = Buffer.concat([out, d]);
                });
                r.on('end', () => {
                    res(out);
                });
            });
        });
    }

    //Write tags to audio file
    async tagAudio(path, track) {
        let cover;
        try {
            cover = await this.downloadCover(track.albumArt.full);
        } catch (e) {}
        

        if (path.toLowerCase().endsWith('.mp3')) {
            //Load
            const audioData = await fs.promises.readFile(path);
            const writer = new ID3Writer(audioData);

            writer.setFrame('TIT2', track.title);
            if (track.artists) writer.setFrame('TPE1', track.artists.map((a) => a.name));
            if (track.album) writer.setFrame('TALB', track.album.title);
            if (track.trackNumber) writer.setFrame('TRCK', track.trackNumber);
            if (cover) writer.setFrame('APIC', {
                    type: 3,
                    data: cover,
                    description: 'Cover'
                });
            writer.addTag();

            //Write
            await fs.promises.writeFile(path, Buffer.from(writer.arrayBuffer));
        }
        //Tag FLAC
        if (path.toLowerCase().endsWith('.flac')) {
            const flac = new Metaflac(path);
            flac.removeAllTags();

            flac.setTag(`TITLE=${track.title}`);
            if (track.album)flac.setTag(`ALBUM=${track.album.title}`);
            if (track.trackNumber) flac.setTag(`TRACKNUMBER=${track.trackNumber}`);
            if (track.artistString) flac.setTag(`ARTIST=${track.artistString}`);
            if (cover) flac.importPicture(cover);

            flac.save();
        }

    }
}


module.exports = {Downloads, Download};
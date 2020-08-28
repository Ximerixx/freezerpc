const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');
const axios = require('axios').default;
const {DeezerAPI, DeezerDecryptionStream} = require('./deezer');
const {Settings} = require('./settings');
const {Track, Album, Artist, Playlist, DeezerProfile, SearchResults, DeezerLibrary, DeezerPage, Lyrics} = require('./definitions');
const {Downloads} = require('./downloads');

let settings;
let deezer;
let downloads;

let sockets = [];

//Express
const app = express();
app.use(express.json({limit: '50mb'}));
app.use(express.static(path.join(__dirname, '../client', 'dist')));
//Server
const server = require('http').createServer(app);
const io = require('socket.io').listen(server);

//Get playback info
app.get('/playback', async (req, res) => {
    try {
        let data = await fs.promises.readFile(Settings.getPlaybackInfoPath(), 'utf-8');
        return res.json(data);
    } catch (e) {}
    
    return res.json({});
});

//Save playback info
app.post('/playback', async (req, res) => {
    if (req.body) {
        let data = JSON.stringify(req.body);
        await fs.promises.writeFile(Settings.getPlaybackInfoPath(), data, 'utf-8');
    }
    res.status(200).send('');
});

//Get settings
app.get('/settings', (req, res) => {
    res.json(settings);
});

//Save settings
app.post('/settings', async (req, res) => {
    if (req.body) {
        Object.assign(settings, req.body);
        downloads.settings = settings;
        await settings.save();
    }

    res.status(200).send('');
});

//Post with body {"arl": ARL}
app.post('/authorize', async (req, res) => {
    if (!req.body.arl || req.body.arl.length < 100) return res.status(500).send('Invalid ARL');
    
    //Check if arl valid
    deezer.arl = req.body.arl;
    settings.arl = req.body.arl;

    if (await (deezer.authorize())) {
        res.status(200).send('OK');
        return;
    }

    res.status(500).send('Authorization error / Invalid ARL.');
});

//Get track by id
app.get('/track/:id', async (req, res) => {
    let data = await deezer.callApi('deezer.pageTrack', {sng_id: req.params.id.toString()});
    res.send(new Track(data.results.DATA));
});

//Get album by id
app.get('/album/:id', async (req, res) => {
    let data = await deezer.callApi('deezer.pageAlbum', {alb_id: req.params.id.toString(), lang: 'us'});
    res.send(new Album(data.results.DATA, data.results.SONGS));
});

//Get artist by id
app.get('/artist/:id', async (req, res) => {
    let data = await deezer.callApi('deezer.pageArtist', {art_id: req.params.id.toString(), lang: 'us'});
    res.send(new Artist(data.results.DATA, data.results.ALBUMS, data.results.TOP));
});

//Get playlist by id
//start & full query parameters
app.get('/playlist/:id', async (req, res) => {
    //Set anything to `full` query parameter to get entire playlist
    if (!req.query.full) {
        let data = await deezer.callApi('deezer.pagePlaylist', {
            playlist_id: req.params.id.toString(),
            lang: 'us',
            nb: 50,
            start: req.query.start ? parseInt(req.query.start, 10) : 0,
            tags: true
        });
        return res.send(new Playlist(data.results.DATA, data.results.SONGS));
    }

    //Entire playlist
    let chunk = 200;
    let data = await deezer.callApi('deezer.pagePlaylist', {
        playlist_id: req.params.id.toString(), 
        lang: 'us', 
        nb: chunk, 
        start: 0,
        tags: true
    });
    let playlist = new Playlist(data.results.DATA, data.results.SONGS);
    let missingChunks = Math.ceil((playlist.trackCount - playlist.tracks.length)/chunk);
    //Extend playlist
    for(let i=0; i<missingChunks; i++) {
        let d = await deezer.callApi('deezer.pagePlaylist', {
            playlist_id: id.toString(), 
            lang: 'us', 
            nb: chunk, 
            start: (i+1)*chunk,
            tags: true
        });
        playlist.extend(d.results.SONGS);
    }
    res.send(playlist);
});

//DELETE playlist
app.delete('/playlist/:id', async (req, res) => {
    await deezer.callApi('playlist.delete', {playlist_id: req.params.id.toString()});
    res.sendStatus(200);
});

//POST create playlist
// {
//     desciption,
//     title,
//     type: 'public' || 'private',
//     track: trackID
// }
app.post('/playlist', async (req, res) => {
    await deezer.callApi('playlist.create', {
        description: req.body.description,
        title: req.body.title,
        status: req.body.type == 'public' ? 2 : 1,
        songs: req.body.track ? [[req.body.track, 0]] : []
    });

    res.sendStatus(200);
});

//POST track to playlist
//Body {"track": "trackId"}
app.post('/playlist/:id/tracks', async (req, res) => {
    await deezer.callApi('playlist.addSongs', {
        offset: -1,
        playlist_id: req.params.id,
        songs: [[req.body.track, 0]]
    });

    res.sendStatus(200);
});

//DELETE track from playlist
//Body {"track": "trackId"}
app.delete('/playlist/:id/tracks', async (req, res) => {
    await deezer.callApi('playlist.deleteSongs', {
        playlist_id: req.params.id,
        songs: [[req.body.track, 0]]
    });

    res.sendStatus(200);
});

//Get more albums
//ID = artist id, QP start = offset
app.get('/albums/:id', async (req, res) => {
    let data = await deezer.callApi('album.getDiscography', {
        art_id: parseInt(req.params.id.toString(), 10),
        discography_mode: "all",
        nb: 25,
        nb_songs: 200,
        start: req.query.start ? parseInt(req.query.start, 10) : 0
    });

    let albums = data.results.data.map((a) => new Album(a));
    res.send(albums);
})

//Search, q as query parameter
app.get('/search', async (req, res) => {
    let data = await deezer.callApi('deezer.pageSearch', {query: req.query.q, nb: 100});
    res.send(new SearchResults(data.results));
});

//Get user profile data
app.get('/profile', async (req, res) => {
    let data = await deezer.callApi('deezer.getUserData');
    let profile = new DeezerProfile(data.results);
    res.send(profile);
});

//Get list of `type` from library
app.get('/library/:type', async (req, res) => {
    let type = req.params.type;
    let data = await deezer.callApi('deezer.pageProfile', {
        nb: 50,
        tab: (type == 'tracks') ? 'loved' : type,
        user_id: deezer.userId
    });
    res.send(new DeezerLibrary(data.results.TAB, type));
});

//DELETE from library
app.delete('/library/:type', async (req, res) => {
    let type = req.params.type;
    let id = req.query.id;

    if (type == 'track') await deezer.callApi('favorite_song.remove', {SNG_ID: id});
    if (type == 'album') await deezer.callApi('album.deleteFavorite', {ALB_ID: id});
    if (type == 'playlist') await deezer.callApi('playlist.deleteFavorite', {playlist_id: parseInt(id, 10)});
    if (type == 'artist') await deezer.callApi('artist.deleteFavorite', {ART_ID: id});

    res.sendStatus(200);
});

//PUT (add) to library
app.put('/library/:type', async (req, res) => {
    let type = req.params.type;
    let id = req.query.id;

    if (type == 'track') await deezer.callApi('favorite_song.add', {SNG_ID: id});
    if (type == 'album') await deezer.callApi('album.addFavorite', {ALB_ID: id});
    if (type == 'artist') await deezer.callApi('artist.addFavorite', {ART_ID: id});
    if (type == 'playlist') await deezer.callApi('playlist.addFavorite', {parent_playlist_id: parseInt(id)});

    res.sendStatus(200);
});


//Get streaming metadata, quality fallback
app.get('/streaminfo/:info', async (req, res) => {
    let info = req.params.info;
    let quality = req.query.q ? req.query.q : 3;
    return res.json(await qualityFallback(info, quality));
});

// S T R E A M I N G
app.get('/stream/:info', (req, res) => {
    //Parse stream info
    let quality = req.query.q ? req.query.q : 3;
    let url = Track.getUrl(req.params.info,  quality);
    let trackId = req.params.info.substring(35);

    //MIME type of audio
    let mime = 'audio/mp3';
    if (quality == 9) mime = 'audio/flac';

    //Parse range header
    let range = 'bytes=0-';
    if (req.headers.range) range = req.headers.range;
    let rangeParts = range.replace(/bytes=/, '').split('-');
    let start = parseInt(rangeParts[0], 10);
    let end = '';
    if (rangeParts.length >= 2) end = rangeParts[1];

    //Round to 2048 for deezer
    let dStart = start - (start % 2048);

    //Make request to Deezer CDN
    https.get(url, {headers: {'Range': `bytes=${dStart}-${end}`}}, (r) => {
        //Error from Deezer
        //TODO: Quality fallback
        if (r.statusCode < 200 || r.statusCode > 300) {
            res.status(404);
            return res.end();
        }

        let decryptor = new DeezerDecryptionStream(trackId, {offset: start});

        //Get total size
        let chunkSize = parseInt(r.headers["content-length"], 10)
        let total = chunkSize;
        if (start > 0) total += start;

        //Ranged request
        if (req.headers.range) {
            end = total - 1

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${total}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mime
            });
        
        //Normal (non range) request
        } else {
            res.writeHead(200, {
                'Content-Length': total,
                'Content-Type': mime
            });
        }

        //Pipe: Deezer -> Decryptor -> Response
        decryptor.pipe(res);
        r.pipe(decryptor);
    });

});

//Get deezer page
app.get('/page', async (req, res) => {
    let target = req.query.target.replace(/"/g, '');

    let st = ['album', 'artist', 'channel', 'flow', 'playlist', 'smarttracklist', 'track', 'user'];
    let data = await deezer.callApi('page.get', {}, {
        'PAGE': target,
        'VERSION': '2.3',
        'SUPPORT': {
            'grid': st,
            'horizontal-grid': st,
            'item-highlight': ['radio'],
            'large-card': ['album', 'playlist', 'show', 'video-link'],
            'ads': [] //None
        },
        'LANG': 'us',
        'OPTIONS': []
    });
    res.send(new DeezerPage(data.results));
});

//Get smart track list or flow tracks
app.get('/smarttracklist/:id', async (req, res) => {
    let id = req.params.id;
    
    //Flow not normal STL
    if (id == 'flow') {
        let data = await deezer.callApi('radio.getUserRadio', {
            user_id: deezer.userId
        });
        let tracks = data.results.data.map((t) => new Track(t));
        return res.send(tracks);
    }

    //Normal STL
    let data = await deezer.callApi('smartTracklist.getSongs', {
        smartTracklist_id: id
    });
    let tracks = data.results.data.map((t) => new Track(t));
    return res.send(tracks);
});

//Load lyrics, ID = SONG ID
app.get('/lyrics/:id', async (req, res) => {
    let data = await deezer.callApi('song.getLyrics', {
        sng_id: parseInt(req.params.id, 10)
    });
    if (!data.results || data.error.length > 0) return res.status(502).send('Lyrics not found!');

    res.send(new Lyrics(data.results));
});

//Post list of tracks to download
app.post('/downloads', async (req, res) => {
    let tracks = req.body;
    let quality = req.query.q;
    for (let track of tracks) {
        downloads.add(track, quality);
    }

    res.status(200).send('OK');
});

//PUT to /download to start
app.put('/download', async (req, res) => {
    await downloads.start();
    res.status(200).send('OK');
});

//DELETE to /download to stop/pause
app.delete('/download', async (req, res) => {
    await downloads.stop();
    res.status(200).send('OK');
})

//Get all downloads
app.get('/downloads', async (req, res) => {
    res.json({
        downloading: downloads.downloading,
        downloads: downloads.downloads.map((d) => {
            return d.toDB();
        })
    });
});

//Redirect to index on unknown path
app.all('*', (req, res) => {
    res.redirect('/');
});

// S O C K E T S
io.on('connection', (socket) => {
    sockets.push(socket);
    //Remove on disconnect
    socket.on('disconnect', () => {
        sockets.splice(sockets.indexOf(socket), 1);
    });
});

//Quality fallback
async function qualityFallback(info, quality = 3) {
    if (quality == 1) return {
        quality: '128kbps',
        format: 'MP3',
        source: 'stream',
        url: `/stream/${info}?q=1`
    };
    try {
        let res = await axios.head(Track.getUrl(info, quality));
        if (quality == 3) {
            return {
                quality: '320kbps',
                format: 'MP3',
                source: 'stream',
                url: `/stream/${info}?q=3`
            }
        }
        //Bitrate will be calculated in client
        return {
            quality: res.headers['content-length'],
            format: 'FLAC',
            source: 'stream',
            url: `/stream/${info}?q=9`
        }
    } catch (e) {
        //Fallback
        //9 - FLAC
        //3 - MP3 320
        //1 - MP3 128
        let q = quality;
        if (quality == 9) q = 3;
        if (quality == 3) q = 1;
        return qualityFallback(info, q);
    }
}

//ecb = Error callback
async function createServer(electron = false, ecb) {
    //Prepare globals
    settings = new Settings(electron);
    settings.load();

    deezer = new DeezerAPI(settings.arl, electron);

    //Prepare downloads
    downloads = new Downloads(settings, () => {
        //Emit queue change to socket
        sockets.forEach((s) => {
            s.emit('downloads', {
                downloading: downloads.downloading,
                downloads: downloads.downloads
            });
        });

        //Emit download progress updates
        setInterval(() => {
            sockets.forEach((s) => {
                if (!downloads.download) {
                    s.emit('download', null);
                    return;
                }
                
                s.emit('download', {
                    id: downloads.download.id,
                    size: downloads.download.size,
                    downloaded: downloads.download.downloaded,
                    track: downloads.download.track,
                    path: downloads.download.path
                });
            });
        }, 500);

    });
    await downloads.load();

    //Start server
    server.on('error', (e) => {
        ecb(e);
    });
    server.listen(settings.port, settings.serverIp);
    console.log(`Running on: http://${settings.serverIp}:${settings.port}`);

    return settings;
}

module.exports = {createServer};
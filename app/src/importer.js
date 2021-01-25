const {EventEmitter} = require('events');
const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('./winston');

class Importer extends EventEmitter {
    constructor(deezer) {
        super();
        this.deezer = deezer;
        this.tracks = [];
    }

    //Conver spotify URL to URI
    async getSpotifyURI(inputUrl) {
        let url = new URL(inputUrl);
        return 'spotify' + url.pathname.replace(new RegExp('/', 'g'), ':');
    }

    //Import spotify playlist
    async importSpotifyPlaylist(url) {
        //Clean
        this.tracks = [];
        try {
            //Fetch
            let uri = await this.getSpotifyURI(url);
            let spotifyData = await Spotify.getEmbedData(uri);
            if (!spotifyData.tracks.items) throw Error("No items!");

            for (let track of spotifyData.tracks.items) {
                //Output track
                let out = new ImporterTrack(
                    track.track.name, 
                    track.track.artists.map(a => a.name).join(', '), 
                    (track.track.album.images.length > 0) ? track.track.album.images[0].url : null
                );
                //Match
                try {
                    let deezerData = await this.deezer.callPublicApi('track', 'isrc:' + track.track.external_ids.isrc);
                    if (deezerData.id.toString()) {
                        //Found track
                        out.id = deezerData.id.toString();
                        out.ok = true;
                    }
                } catch (e) {
                    logger.error(`Error importing: Spotify: ${track.track.id} ${e}`);
                }
                //Send back
                this.emit('imported', out);
                this.tracks.push(out);
            }
            //Emit done with playlist details
            this.emit('done', {
                title: spotifyData.name,
                description: spotifyData.description,
                tracks: this.tracks
            });
        } catch (e) {
            //Emit error on error
            logger.error(`Error importing: ${e}`);
            this.emit('error', `${e}`);
        }
        
    }

}

//Track only with most important metadata for UI
class ImporterTrack {
    constructor(title, artist, art) {
        this.id = null;
        this.title = title;
        this.artist = artist;
        this.art = art;
        this.ok = false;
    }
}

class Spotify {
    constructor() {}

    //Fetch JSON data from embeded spotify
    static async getEmbedData(uri) {
        //Fetch
        let url = `https://embed.spotify.com/?uri=${uri}`;
        let res = await axios.get(url);
        const $ = cheerio.load(res.data);

        //Get JSON
        let data = JSON.parse(decodeURIComponent($('#resource').html()));
        return data;
    }
}

module.exports = {Importer};
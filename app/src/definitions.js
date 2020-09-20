const {DeezerAPI} = require('./deezer');

//Datatypes, constructor parameters = gw_light API call.
class Track {
    constructor(json) {
        this.id = json.SNG_ID.toString();
        this.title = `${json.SNG_TITLE}${json.VERSION ? ` ${json.VERSION}` : ''}`;
        //Duration as ms for easier use in frontend
        this.duration = parseInt(json.DURATION.toString(), 10) * 1000; 
        this.albumArt = new DeezerImage(json.ALB_PICTURE);
        this.artists = (json.ARTISTS ? json.ARTISTS : [json]).map((a) => new Artist(a));
        //Helper
        this.artistString = this.artists.map((a) => a.name).join(', ');

        this.album = new Album(json);
        this.trackNumber = parseInt((json.TRACK_NUMBER || 0).toString(), 10);
        this.diskNumber = parseInt((json.DISK_NUMBER || 0).toString(), 10);
        this.explicit = json['EXPLICIT_LYRICS'] == 1 ? true:false;
        this.lyricsId = json.LYRICS_ID;

        this.library = null;

        //Generate URL Part
        //0 - 32    = MD5 ORIGIN
        //33 -      = 1/0 if md5origin ends with .mp3
        //34 - 35   = MediaVersion
        //Rest      = Track ID
        let md5 = json.MD5_ORIGIN.replace('.mp3', '');
        let md5mp3bit = json.MD5_ORIGIN.includes('.mp3') ? '1' : '0';
        let mv = json.MEDIA_VERSION.toString().padStart(2, '0');
        this.streamUrl = `${md5}${md5mp3bit}${mv}${this.id}`;
    }

    //Get Deezer CDN url by streamUrl
    static getUrl(info, quality = 3) {
        let md5origin = info.substring(0, 32);
        if (info.charAt(32) == '1') md5origin += '.mp3';
        let mediaVersion = parseInt(info.substring(33, 34)).toString();
        let trackId = info.substring(35);
        let url = DeezerAPI.getUrl(trackId, md5origin, mediaVersion, quality);
        return url;
    }
}

class Album {
    constructor(json, tracksJson = {data: []}) {
        this.id = json.ALB_ID.toString();
        this.title = json.ALB_TITLE;
        this.art = new DeezerImage(json.ALB_PICTURE);
        this.fans = json.NB_FAN;
        this.tracks = tracksJson.data.map((t) => new Track(t));
        this.artists = (json.ARTISTS ? json.ARTISTS : [json]).map((a) => new Artist(a));
        this.releaseDate = json.DIGITAL_RELEASE_DATE;
        
        //Explicit
        this.explicit = false;
        if (json.EXPLICIT_LYRICS && json.EXPLICIT_LYRICS.toString() == "1") this.explicit = true;
        if (json.EXPLICIT_ALBUM_CONTENT) {
            if (json.EXPLICIT_ALBUM_CONTENT.EXPLICIT_LYRICS_STATUS == 4) this.explicit = true;
            if (json.EXPLICIT_ALBUM_CONTENT.EXPLICIT_LYRICS_STATUS == 1) this.explicit = true;
        }

        //Type
        this.type = 'album';
        if (json.TYPE && json.TYPE.toString() == "0") this.type = 'single';
        if (json.ROLE_ID == 5) this.type = 'featured';

        //Helpers
        this.artistString = this.artists.map((a) => a.name).join(', ');
    }
}

class Artist {
    constructor(json, albumsJson = {data: []}, topJson = {data: []}) {
        this.id = json.ART_ID.toString();
        this.name = json.ART_NAME;
        this.fans = json.NB_FAN;
        this.picture = new DeezerImage(json.ART_PICTURE, 'artist');
        this.albumCount = albumsJson.total;
        this.albums = albumsJson.data.map((a) => new Album(a));
        this.topTracks = topJson.data.map((t) => new Track(t));
    }
}

class Playlist {
    constructor(json, tracksJson = {data: []}) {
        this.id = json.PLAYLIST_ID.toString(),
        this.title = json.TITLE,
        this.trackCount = json.NB_SONG ? json.NB_SONG : tracksJson.total;
        this.image = new DeezerImage(json.PLAYLIST_PICTURE, 'playlist');
        this.fans = json.NB_FAN;
        this.duration = parseInt((json.DURATION ? json.DURATION : 0).toString(), 10) * 1000;
        this.description = json.DESCRIPTION;
        this.user = new User(
            json.PARENT_USER_ID,
            json.PARENT_USERNAME,
            new DeezerImage(json.PARENT_USER_PICTURE, 'user')
        );
        this.tracks = tracksJson.data.map((t) => new Track(t));
    }

    //Extend tracks
    extend(tracksJson = {data: []}) {
        let tracks = tracksJson.data.map((t) => new Track(t));
        this.tracks.push(...tracks);
    }
}

class User {
    constructor(id, name, picture) {
        this.id = id;
        this.name = name;
        this.picture = picture;
    }
}

class DeezerImage {
    constructor(hash, type='cover') {
        this.hash = hash;
        this.type = type;
        //Create full and thumb, to standardize size and because functions aren't preserved
        this.full = this.url(1400);
        this.thumb = this.url(256);
    }

    url(size = 256) {
        return `https://e-cdns-images.dzcdn.net/images/${this.type}/${this.hash}/${size}x${size}-000000-80-0-0.jpg`;
    }
}

class SearchResults {
    constructor(json) {
        this.albums = json.ALBUM.data.map((a) => new Album(a));
        this.artists = json.ARTIST.data.map((a) => new Artist(a));
        this.tracks = json.TRACK.data.map((t) => new Track(t));
        this.playlists = json.PLAYLIST.data.map((p) => new Playlist(p));
        this.top = json.TOP_RESULT;
    }
}

class DeezerProfile {
    constructor(json) {
        this.token = json.checkForm;
        this.id = json.USER.USER_ID;
        this.name = json.USER.BLOG_NAME;
        this.favoritesPlaylist = json.USER.LOVEDTRACKS_ID;
        this.picture = new DeezerImage(json.USER.USER_PICTURE, 'user');
    }
}

class DeezerLibrary {
    //Pass 'TAB' from API to parse
    constructor(json, type='tracks') {
        switch (type) {
            case 'tracks':
                this.count = json.loved.total;
                this.data = json.loved.data.map((t) => new Track(t));
                break;
            case 'albums':
                this.count = json.albums.total;
                this.data = json.albums.data.map((a) => new Album(a));
                break;
            case 'artists':
                this.count = json.artists.total;
                this.data = json.artists.data.map((a) => new Artist(a));
                break;
            case 'playlists':
                this.count = json.playlists.total;
                this.data = json.playlists.data.map((p) => new Playlist(p));
                break;
        }
    }
}

class SmartTrackList {
    constructor(json) {
        this.title = json.TITLE;
        this.subtitle = json.SUBTITLE;
        this.description = json.DESCRIPTION;
        this.id = json.SMARTTRACKLIST_ID
        this.cover = new DeezerImage(json.COVER.MD5, json.COVER.TYPE);
    }
}

class DeezerPage {
    constructor(json) {
        this.title = json.title;
        this.sections = json.sections.map((s) => new ChannelSection(s));
    }
}

class DeezerChannel {
    constructor(json, target) {
        this.title = json.title;
        this.image = new DeezerImage(json.pictures[0].md5, json.pictures[0].type);
        this.color = json.background_color;
        this.id = json.id;
        this.slug = json.slug; //Hopefully it's used for path
        this.target = target;
    }
}

class ChannelSection {
    constructor(json) {
        //Parse layout
        switch (json.layout) {
            case 'grid': this.layout = 'grid'; break;
            case 'horizontal-grid': this.layout = 'row'; break;
            default: this.layout = 'row'; break;
        }
        this.title = json.title;
        this.hasMore = json.hasMoreItems ? true : false;
        this.target = json.target;
        this.items = json.items.map((i) => new ChannelSectionItem(i));
    }
}

class ChannelSectionItem {
    constructor(json) {
        this.id = json.id;
        this.title = json.title;
        this.type = json.type;
        this.subtitle = json.subtitle;
        //Parse data
        switch (this.type) {
            case 'flow':
            case 'smarttracklist':
                this.data = new SmartTrackList(json.data);
                break;
            case 'playlist':
                this.data = new Playlist(json.data);
                break;
            case 'artist':
                this.data = new Artist(json.data);
                break;
            case 'channel':
                this.data = new DeezerChannel(json.data, json.target);
                break;
            case 'album':
                this.data = new Album(json.data);
                break;
        }
    }
}

class Lyrics {
    constructor(json) {
        this.id = json.LYRICS_ID;
        this.writer = json.LYRICS_WRITERS;
        this.text = [];
        if (json.LYRICS_TEXT) {
            this.text = json.LYRICS_TEXT.replace(new RegExp('\\r', 'g'), '').split('\n');
        }

        //Parse invidual lines
        this.lyrics = [];
        if (json.LYRICS_SYNC_JSON) {
            for (let l of json.LYRICS_SYNC_JSON) {
                let lyric = Lyric.parseJson(l);
                if (lyric) this.lyrics.push(lyric);
            }
        }
        
    }
}

class Lyric {
    //NOT for parsing from deezer
    constructor(offset, text, lrcTimestamp) {
        this.offset = parseInt(offset.toString(), 10);
        this.text = text;
        this.lrcTimestamp = lrcTimestamp;
    }
    //Can return null if invalid lyric
    static parseJson(json) {
        if (!json.milliseconds || !json.line || json.line == '') return;
        return new Lyric(json.milliseconds, json.line, json.lrc_timestamp);
    }
}

module.exports = {Track, Album, Artist, Playlist, User, SearchResults, 
    DeezerImage, DeezerProfile, DeezerLibrary, DeezerPage, Lyrics};
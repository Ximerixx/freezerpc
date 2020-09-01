import Vue from 'vue';
import App from './App.vue';
import router from './js/router';
import vuetify from './js/vuetify';
import axios from 'axios';
import VueEsc from 'vue-esc';
import VueSocketIO from 'vue-socket.io';

//Globals
//Axios
let axiosInstance = axios.create({
    baseURL: `${window.location.origin}`,
    timeout: 16000,
    responseType: 'json'
});
Vue.prototype.$axios = axiosInstance;

//Duration formatter
Vue.prototype.$duration = (s) => {
    let pad = (n, z = 2) => ('00' + n).slice(-z);
    return ((s%3.6e6)/6e4 | 0) + ':' + pad((s%6e4)/1000|0);
};

//Abbrevation 
Vue.prototype.$abbreviation = (n) => {
    if (!n || n == 0) return '0';
    var base = Math.floor(Math.log(Math.abs(n))/Math.log(1000));
    var suffix = 'KMB'[base-1];
    return suffix ? String(n/Math.pow(1000,base)).substring(0,3)+suffix : ''+n;
}

//Add thousands commas
Vue.prototype.$numberString = (n) => {
    if (!n || n == 0) return '0';
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

//Filesize
Vue.prototype.$filesize = (bytes) => {
    if (bytes === 0) return '0 B';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

//Sockets
Vue.use(new VueSocketIO({
    connection: window.location.origin
}));

Vue.config.productionTip = false;
Vue.use(VueEsc);

new Vue({
    data: {
        //Globals
        settings: {},
        profile: {},
        authorized: false,
        loadingPromise: null,

        //Downloads
        downloading: false,
        downloads: [],
        download: null,

        //Player
        track: null,
        audio: null,
        volume: 0.00,
        //0 = Stopped, 1 = Paused, 2 = Playing, 3 = Loading
        state: 0,
        loaders: 0,
        playbackInfo: {},
        position: 0,
        muted: false,
        //Gapless playback meta
        gapless: {
            promise: null,
            audio: null,
            info: null,
            track: null
        },

        //Library cache
        libraryTracks: [],

        //Queue data
        queue: {
            data: [],
            index: -1,
            source: {
                text: 'None',
                source: 'none',
                data: 'none'
            }
        },

        //Used to prevent double listen logging
        logListenId: null
    },
    methods: {
        // PLAYBACK METHODS
        isPlaying() {
            return this.state == 2;
        },

        play() {
            if (!this.audio || this.state != 1) return;
            this.audio.play();
            this.state = 2;

            this.logListen();
        },
        pause() {
            if (!this.audio || this.state != 2) return;
            this.audio.pause();
            this.state = 1;
        },
        toggle() {
            if (this.isPlaying()) return this.pause();
            this.play();
        },
        seek(t) {
            if (!this.audio) return;
            //ms -> s
            this.audio.currentTime = (t / 1000);
        },

        //Current track duration
        duration() {
            //Prevent 0 division
            if (!this.audio) return 1;
            return this.audio.duration * 1000;
        },

        //Replace queue, has to make clone of data to not keep references
        replaceQueue(newQueue) {
            this.queue.data = Object.assign([], newQueue);
        },
        //Add track to queue at index
        addTrackIndex(track, index) {
            this.queue.data.splice(index, 0, track);
        },

        //Play at index in queue
        async playIndex(index) {
            if (index >= this.queue.data.length || index < 0) return;
            this.queue.index = index;
            await this.playTrack(this.queue.data[this.queue.index]);
            this.play();
            this.savePlaybackInfo();
        },
        //Skip n tracks, can be negative
        skip(n) {
            let newIndex = this.queue.index + n;
            //Out of bounds
            if (newIndex < 0 || newIndex >= this.queue.data.length) return;
            this.playIndex(newIndex);
        },
        toggleMute() {
            if (this.audio) this.audio.muted = !this.audio.muted;
            this.muted = !this.muted;
        },

        async playTrack(track) {
            if (!track || !track.streamUrl) return;
            this.resetGapless();

            this.track = track;
            this.loaders++;
            this.state = 3;
            //Stop audio
            let autoplay = (this.state == 2);
            if (this.audio) this.audio.pause();
            if (this.audio) this.audio.currentTime = 0;
            
            //Load track meta
            this.playbackInfo = await this.loadPlaybackInfo(track.streamUrl, track.duration);

            //Stream URL
            let url = `${window.location.origin}${this.playbackInfo.url}`;
            //Cancel loading
            this.loaders--;
            if (this.loaders > 0) {
                return;
            }

            //Audio
            this.audio = new Audio(url);
            this.configureAudio();
            this.state = 1;
            if (autoplay) this.play();
        },
        //Configure html audio element
        configureAudio() {
            //Listen position updates
            this.audio.addEventListener('timeupdate', () => {
                this.position = this.audio.currentTime * 1000;

                //Gapless playback
                if (this.position >= (this.duration() - 5000) && this.state == 2) {
                    this.loadGapless();
                }
            });
            this.audio.muted = this.muted;
            this.audio.volume = this.volume;
            
            this.audio.addEventListener('ended', async () => {
                //Load gapless
                if (this.gapless.promise || this.gapless.audio) {
                    this.state = 3;
                    if (this.gapless.promise) await this.gapless.promise;

                    this.audio = this.gapless.audio;
                    this.playbackInfo = this.gapless.info;
                    this.track = this.gapless.track;
                    this.queue.index++;
                    this.resetGapless();

                    this.configureAudio();
                    //Play
                    this.state = 2;
                    this.audio.play();
                    this.logListen();
                    await this.savePlaybackInfo();
                    return;
                }
                //Skip to next track
                this.skip(1);
                this.savePlaybackInfo();
            });
            this.updateMediaSession();
        },
        //Update media session with current track metadata
        updateMediaSession() {
            if (!this.track || !('mediaSession' in navigator)) return;
            // eslint-disable-next-line no-undef
            navigator.mediaSession.metadata = new MediaMetadata({
                title: this.track.title,
                artist: this.track.artistString,
                album: this.track.album.title,
                artwork: [
                    {src: this.getImageUrl(this.track.albumArt, 256), sizes: '256x256', type: 'image/jpeg'},
                    {src: this.getImageUrl(this.track.albumArt, 512), sizes: '512x512', type: 'image/jpeg'}
                ]
            });
            //Controls
            navigator.mediaSession.setActionHandler('play', this.play);
            navigator.mediaSession.setActionHandler('pause', this.pause);
            navigator.mediaSession.setActionHandler('nexttrack', () => this.skip(1));
            navigator.mediaSession.setActionHandler('previoustrack', () => this.skip(-1));
        },
        //Get Deezer CDN image url
        getImageUrl(img, size = 256) {
            return `https://e-cdns-images.dzcdn.net/images/${img.type}/${img.hash}/${size}x${size}-000000-80-0-0.jpg`
        },

        async loadPlaybackInfo(streamUrl, duration) {
            //Get playback info
            let quality = this.settings.streamQuality;
            let infoUrl = `/streaminfo/${streamUrl}?q=${quality}`;
            let res = await this.$axios.get(infoUrl);
            let info = res.data;
            //Calculate flac bitrate
            if (!info.quality.includes('kbps')) {
                info.quality = Math.round((parseInt(info.quality, 10)*8) / duration) + 'kbps';
            }
            return info;
        },

        //Reset gapless playback meta
        resetGapless() {
            this.gapless = {promise: null,audio: null,info: null,track: null};
        },
        //Load next track for gapless
        async loadGapless() {
            if (this.loaders != 0 || this.gapless.promise || this.gapless.audio) return;
            //Last song
            if (this.queue.index+1 >= this.queue.data.length) return;

            //Save promise
            let resolve;
            this.gapless.promise = new Promise((res) => {resolve = res});
            
            //Load meta
            this.gapless.track = this.queue.data[this.queue.index + 1];
            let info = await this.loadPlaybackInfo(this.gapless.track.streamUrl, this.gapless.track.duration);
            this.gapless.info = info
            this.gapless.audio = new Audio(`${window.location.origin}${info.url}`);

            //Might get canceled
            if (this.gapless.promise) resolve();
        },

        //Update & save settings
        async saveSettings() {
            this.settings.volume = this.volume;
            await this.$axios.post('/settings', this.settings);

            //Update settings in electron
            if (this.settings.electron) {
                const {ipcRenderer} = window.require('electron');
                ipcRenderer.send('updateSettings', this.settings);
            }
        },

        async savePlaybackInfo() {
            let data = {
                queue: this.queue,
                position: this.position,
                track: this.track
            }
            await this.$axios.post('/playback', data);
        },
        //Get downloads from server
        async getDownloads() {
            let res = await this.$axios.get('/downloads');
            this.downloading = res.data.downloading;
            this.downloads = res.data.downloads;
        },
        //Start stop downloading
        async toggleDownload() {
            if (this.downloading) {
                await this.$axios.delete('/download');
            } else {
                await this.$axios.put('/download');
            }
        },

        //Deezer doesn't give information if items are in library, so it has to be cachced
        async cacheLibrary() {
            let res = await this.$axios.get(`/playlist/${this.profile.favoritesPlaylist}?full=idk`);
            this.libraryTracks = res.data.tracks.map((t) => t.id);
        },

        //Log song listened to deezer, only if allowed
        async logListen() {
            if (!this.settings.logListen) return;
            if (this.logListenId == this.track.id) return;
            if (!this.track || !this.track.id) return;

            this.logListenId = this.track.id;
            await this.$axios.put(`/log/${this.track.id}`);
        }
    },
    async created() {
        //Load settings, create promise so `/login` can await it
        let r;
        this.loadingPromise = new Promise((resolve) => r = resolve);
        let res = await this.$axios.get('/settings');
        this.settings = res.data;
        this.volume = this.settings.volume;

        //Restore playback data
        let pd = await this.$axios.get('/playback');
        if (pd.data != {}) {
            if (pd.data.queue) this.queue = pd.data.queue;
            if (pd.data.track) this.track = pd.data.track;
            this.playTrack(this.track).then(() => {
                this.seek(pd.data.position);
            });
        }

        //Check for electron (src: npm isElectron)
        this.settings.electron = ((
            typeof window !== 'undefined' && 
            typeof window.process === 'object' && 
            window.process.type === 'renderer') || (
                typeof navigator === 'object' && typeof navigator.userAgent === 'string' && 
                navigator.userAgent.indexOf('Electron') >= 0
        ));

        //Setup electron callbacks
        if (this.settings.electron) {
            const {ipcRenderer} = window.require('electron');

            //Save files on exit
            ipcRenderer.on('onExit', async () => {
                this.pause();
                await this.saveSettings();
                await this.savePlaybackInfo();
                ipcRenderer.send('onExit', '');
            });

            //Control from electron
            ipcRenderer.on('togglePlayback', () => {
                this.toggle();
            });
            ipcRenderer.on('skipNext', () => {
                this.skip(1);
            });
            ipcRenderer.on('skipPrev', () => {
                this.skip(-1);
            })
        }

        //Get downloads
        this.getDownloads();

        //Sockets
        //Queue change
        this.sockets.subscribe('downloads', (data) => {
            this.downloading = data.downloading;
            this.downloads = data.downloads;
        });
        //Current download change
        this.sockets.subscribe('download', (data) => {
            this.download = data;
        });

        r();
    },
    mounted() {
        //Save settings on unload
        window.addEventListener('beforeunload', () => {
            this.savePlaybackInfo();
            this.saveSettings();
        });
        //Save size
        window.addEventListener('resize', () => {
            this.settings.width = window.innerWidth;
            this.settings.height = window.innerHeight;
        });

        //Keystrokes
        document.addEventListener('keyup', (e) => {
            //Don't handle keystrokes in text fields
            if (e.target.tagName == "INPUT") return;
            //K toggle playback
            //e.keyCode === 32 
            if (e.keyCode === 75 || e.keyCode === 107) this.$root.toggle();
            //L +10s (from YT)
            if (e.keyCode === 108 || e.keyCode === 76) this.$root.seek((this.position + 10000));
            //J -10s (from YT)
            if (e.keyCode === 106 || e.keyCode === 74) this.$root.seek((this.position - 10000));
        });
    },

    router,
    vuetify,
    render: function (h) { return h(App) }
}).$mount('#app');

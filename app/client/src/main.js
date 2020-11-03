import Vue from 'vue';
import App from './App.vue';
import router from './js/router';
import vuetify from './js/vuetify';
import axios from 'axios';
import VueEsc from 'vue-esc';
import VueSocketIO from 'vue-socket.io';
import i18n from './js/i18n';

//Globals
let ipcRenderer;
//Axios
let axiosInstance = axios.create({
    baseURL: `${window.location.origin}`,
    timeout: 16000,
    responseType: 'json'
});
Vue.prototype.$axios = axiosInstance;

//Duration formatter
Vue.prototype.$duration = (ms) => {
    if (isNaN(ms) || ms < 1) return '0:00';
    let s = Math.floor(ms / 1000);
    let hours = Math.floor(s / 3600);
    s %= 3600;
    let min = Math.floor(s / 60);
    let sec = s % 60;
    if (hours == 0) return `${min}:${sec.toString().padStart(2, '0')}`;
    return `${hours}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
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
    connection: window.location.toString(),
    options: {path: '/socket'}
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

        downloads: {},

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

        //Repeat & Shuffle
        //0 - normal, 1 - repeat list, 2 - repeat track
        repeat: 0,
        shuffle: false,

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
        logListenId: null,

        globalSnackbar: null
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
            if (!this.audio || isNaN(t) || !t) return;
            //ms -> s
            this.audio.currentTime = (t / 1000);

            this.updateState();
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
        async skip(n) {
            let newIndex = this.queue.index + n;
            //Out of bounds
            if (newIndex < 0 || newIndex >= this.queue.data.length) return;
            await this.playIndex(newIndex);
        },
        //Skip wrapper with shuffle 
        skipNext() {
            if (this.shuffle) {
                let index = Math.round(Math.random()*this.queue.data.length) - this.queue.index;
                this.skip(index);
                this.savePlaybackInfo();
                return;
            }
            this.skip(1);
            this.savePlaybackInfo();
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
            let playbackInfo = await this.loadPlaybackInfo(track.streamUrl, track.duration);
            if (!playbackInfo) {
                this.skipNext();
                return;
            }
            this.playbackInfo = playbackInfo;

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
            //MediaSession
            this.updateMediaSession();
            
            //Loads more tracks if end of list
            this.loadSTL();
        },
        //Configure html audio element
        configureAudio() {
            //Listen position updates
            this.audio.addEventListener('timeupdate', async () => {
                this.position = this.audio.currentTime * 1000;

                //Gapless playback
                if (this.position >= (this.duration() - (this.settings.crossfadeDuration + 7500)) && this.state == 2) {
                    if (this.repeat != 2)
                        this.loadGapless();
                }

                //Crossfade
                if (this.settings.crossfadeDuration > 0 && this.position >= (this.duration() - this.settings.crossfadeDuration) && this.state == 2 && this.gapless.audio && !this.gapless.crossfade) {
                    this.gapless.crossfade = true;
                    let currentVolume = this.audio.volume;
                    let oldAudio = this.audio;
                    this.audio = this.gapless.audio;
                    this.audio.play();

                    //Update meta
                    this.playbackInfo = this.gapless.info;
                    this.track = this.gapless.track;
                    this.queue.index = this.gapless.index;

                    this.configureAudio();
                    this.updateMediaSession();

                    let volumeStep = currentVolume / (this.settings.crossfadeDuration / 50);
                    for (let i=0; i<(this.settings.crossfadeDuration / 50); i++) {
                        if ((oldAudio.volume - volumeStep) > 0)
                            oldAudio.volume -= volumeStep;
                        this.audio.volume += volumeStep;
                        await new Promise((res) => setTimeout(() => res(), 50));
                    }
                    oldAudio.pause();
                    
                    this.resetGapless();

                    //Save
                    await this.savePlaybackInfo();
                }

                //Scrobble/LogListen
                if (this.position >= this.duration() * 0.75) {
                    this.logListen();
                }
            });
            this.audio.muted = this.muted;
            this.audio.volume = this.volume;
            
            this.audio.addEventListener('ended', async () => {
                if (this.gapless.crossfade) return;

                //Repeat track
                if (this.repeat == 2) {
                    this.seek(0);
                    this.audio.play();
                    return;
                }

                //Shuffle
                if (this.shuffle) {
                    let index = Math.round(Math.random()*this.queue.data.length) - this.queue.index;
                    this.skip(index);
                    this.savePlaybackInfo();
                    return;
                }

                //Repeat list
                if (this.repeat == 1 && this.queue.index == this.queue.data.length - 1) {
                    this.skip(-(this.queue.data.length - 1));
                    return;
                }

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
                    this.updateMediaSession();
                    await this.savePlaybackInfo();
                    return;
                }
                //Skip to next track
                this.skip(1);
                this.savePlaybackInfo();
            });
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
            navigator.mediaSession.setActionHandler('nexttrack', this.skipNext);
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
            let res;
            try {
                res = await this.$axios.get(infoUrl);
            } catch (_) {
                return null;
            }
            
            let info = res.data;
            //Generate qualityString
            switch (info.quality) {
                case 9:
                    info.qualityString = 'FLAC ' + Math.round((info.size*8) / duration) + 'kbps';
                    break;
                case 3:
                    info.qualityString = 'MP3 320kbps';
                    break;
                case 1:
                    info.qualityString = 'MP3 128kbps';
                    break;
            }
            return info;
        },

        //Reset gapless playback meta
        resetGapless() {
            this.gapless = {promise: null,audio: null,info: null,track: null,index:null};
        },
        //Load next track for gapless
        async loadGapless() {
            if (this.loaders != 0 || this.gapless.promise || this.gapless.audio) return;

            //Shuffle
            if (this.shuffle) {
                let index = Math.round(Math.random()*this.queue.data.length) - this.queue.index;
                this.gapless.track = this.queue.data[index];
                this.gapless.index = index;
            } else {
                //Repeat list
                if (this.repeat == 1 && this.queue.index == this.queue.data.length - 1) {
                    this.gapless.track = this.queue.data[0];
                    this.gapless.index = 0;
                } else {
                    //Last song
                    if (this.queue.index+1 >= this.queue.data.length) return;
                    //Next song
                    this.gapless.track = this.queue.data[this.queue.index + 1];
                    this.gapless.index = this.queue.index + 1;
                }
            }

            //Save promise
            let resolve;
            this.gapless.promise = new Promise((res) => {resolve = res});
            
            //Load meta
            let info = await this.loadPlaybackInfo(this.gapless.track.streamUrl, this.gapless.track.duration);
            if (!info) {
                this.resetGapless();
                if (this.gapless.promise) resolve();
            }
            this.gapless.info = info
            this.gapless.audio = new Audio(`${window.location.origin}${info.url}`);
            this.gapless.audio.volume = 0;
            this.gapless.audio.preload = 'auto';
            this.gapless.crossfade = false;

            //Might get canceled
            if (this.gapless.promise) resolve();
        },
        //Load more SmartTrackList tracks
        async loadSTL() {
            if (this.queue.data.length - 1 == this.queue.index && this.queue.source.source == 'smarttracklist') {
                let data = await this.$axios.get('/smarttracklist/' + this.queue.source.data);
                if (data.data) {
                    this.queue.data = this.queue.data.concat(data.data);
                }
                this.savePlaybackInfo();
            }
        },

        //Update & save settings
        async saveSettings() {
            this.settings.volume = this.volume;
            await this.$axios.post('/settings', this.settings);

            //Update settings in electron
            if (this.settings.electron) {
                ipcRenderer.send('updateSettings', this.settings);
            }
        },

        async savePlaybackInfo() {
            let data = {
                queue: this.queue,
                position: this.position,
                track: this.track,
                shuffle: this.shuffle,
                repeat: this.repeat
            }
            await this.$axios.post('/playback', data);
        },
        //Get downloads from server
        async getDownloads() {
            let res = await this.$axios.get('/downloads');
            if (res.data)
                this.downloads = res.data;
        },
        //Start stop downloading
        async toggleDownload() {
            if (this.downloads.downloading) {
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
            if (this.logListenId == this.track.id) return;
            if (!this.track || !this.track.id) return;

            this.logListenId = this.track.id;
            await this.$axios.post(`/log`, this.track);
        },
        //Send state update to integrations
        async updateState() {
            //Wait for duration
            if (this.state == 2 && (this.duration() == null || isNaN(this.duration()))) {
                setTimeout(() => {
                    this.updateState();
                }, 500);
                return;
            }
            this.$socket.emit('stateChange', {
                position: this.position,
                duration: this.duration(),
                state: this.state,
                track: this.track 
            });

            //Update in electron 
            if (this.settings.electron) {
                ipcRenderer.send('playing', this.state == 2);
            }
        },
        updateLanguage(l) {
            i18n.locale = l;
        }
    },

    async created() {
        //Load settings, create promise so `/login` can await it
        let r;
        this.loadingPromise = new Promise((resolve) => r = resolve);
        let res = await this.$axios.get('/settings');
        this.settings = res.data;
        this.$vuetify.theme.themes.dark.primary = this.settings.primaryColor;
        this.$vuetify.theme.themes.light.primary = this.settings.primaryColor;
        if (this.settings.lightTheme) {
            this.$vuetify.theme.dark = false;
            this.$vuetify.theme.light = true;
        }
        i18n.locale = this.settings.language;
        this.volume = this.settings.volume;

        //Restore playback data
        let pd = await this.$axios.get('/playback');
        if (pd.data != {}) {
            if (pd.data.queue) this.queue = pd.data.queue;
            if (pd.data.track) this.track = pd.data.track;
            if (pd.data.shuffle) this.shuffle = pd.data.shuffle;
            if (pd.data.repeat) this.repeat = pd.data.repeat;
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
        if (this.settings.electron)
            ipcRenderer = window.require('electron').ipcRenderer;

        //Setup electron callbacks
        if (this.settings.electron) {
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
        await this.getDownloads();

        //Sockets

        //Queue change
        this.sockets.subscribe('downloads', (data) => {
            this.downloads = data;
        });
        //Current download change
        this.sockets.subscribe('currentlyDownloading', (data) => {
            this.downloads.threads = data;
        });
        //Play at offset (for integrations)
        this.sockets.subscribe('playOffset', async (data) => {
            this.queue.data.splice(this.queue.index + 1, 0, data.track);
            await this.skip(1);
            this.seek(data.position);
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
            if (e.code == "KeyK" || e.code == "Space") this.$root.toggle();
            //L +10s (from YT)
            if (e.code == "KeyL") this.$root.seek((this.position + 10000));
            //J -10s (from YT)
            if (e.code == "KeyJ") this.$root.seek((this.position - 10000));
            //-> +5s (from YT)
            if (e.code == "ArrowRight") this.$root.seek((this.position + 5000));
            //<- -5s (from YT)
            if (e.code == "ArrowLeft") this.$root.seek((this.position - 5000));
            // ^ v - Volume 
            if (e.code == 'ArrowUp' && this.audio) {
                if ((this.audio.volume + 0.05) > 1) {
                    this.audio.volume = 1.00;
                    this.volume = 1.00;
                    return;
                }
                this.audio.volume += 0.05;
                this.volume = this.audio.volume;
            }
            if (e.code == 'ArrowDown' && this.audio) {
                if ((this.audio.volume - 0.05) < 0) {
                    this.audio.volume = 0.00;
                    this.volume = 0.00;
                    return;
                }
                this.audio.volume -= 0.05;
                this.volume = this.audio.volume;
            }
        });
    },

    watch: {
        //Watch state for integrations
        state() {
            this.updateMediaSession();
            this.updateState();
        }
    },

    router,
    vuetify,
    i18n,
    render: function (h) { return h(App) }
}).$mount('#app');

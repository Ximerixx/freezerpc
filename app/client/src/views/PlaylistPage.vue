<template>
<v-list height='calc(100vh - 145px)' class='overflow-y-auto' v-scroll.self='scroll'>
    <v-card class='d-flex'>
        <v-img 
            :src='playlist.image.full' 
            :lazy-src="playlist.image.thumb" 
            max-height="100%"
            max-width="35vh"
            contain
        ></v-img>
        
        <div class='pl-4'>
            <v-overlay absolute :value="loading" z-index="3" opacity='0.9'>
                <v-progress-circular indeterminate></v-progress-circular>
            </v-overlay>
            <h1>{{playlist.title}}</h1>
            <h3>{{playlist.user.name}}</h3>
            <h5>{{playlist.description}}</h5>
            <div class='mt-2' v-if='!loading'>
                <span class='text-subtitle-2'>{{playlist.trackCount}} {{$t("tracks")}}</span><br>
                <span class='text-subtitle-2'>{{$t("Duration")}}: {{$duration(playlist.duration)}}</span><br>
                <span class='text-subtitle-2'>{{$numberString(playlist.fans)}} {{$t('fans')}}</span><br>
            </div>
            
            <div class='my-1'>
                <v-btn color='primary' class='mr-1' @click='play'>
                    <v-icon left>mdi-play</v-icon>
                    {{$t('Play')}}
                </v-btn>
                <v-btn color='red' class='mx-1' @click='library' :loading='libraryLoading'>
                    <v-icon left>mdi-heart</v-icon>
                    {{$t('Library')}}
                </v-btn>
                <v-btn color='green' class='mx-1' @click='download'>
                    <v-icon left>mdi-download</v-icon>
                    {{$t('Download')}}
                </v-btn>
            </div>
        </div>
    </v-card>

    <h1 class='my-2 px-2'>Tracks</h1>
        <v-lazy
            v-for='(track, index) in playlist.tracks'
            :key='index.toString() + "-" + track.id'
            ><TrackTile
                :track='track'
                @click='playIndex(index)'
                :playlistId='playlist.id'
                @remove='trackRemoved(index)'
            ></TrackTile>
        </v-lazy>

    <div class='text-center' v-if='loadingTracks'>
        <v-progress-circular indeterminate></v-progress-circular>
    </div>

    <DownloadDialog :playlistName='playlist.title' :tracks='playlist.tracks' v-if='downloadDialog' @close='downloadDialog = false'></DownloadDialog>

</v-list>
</template>

<script>
import TrackTile from '@/components/TrackTile.vue';
import DownloadDialog from '@/components/DownloadDialog.vue';

export default {
    name: 'PlaylistTile',
    components: {
        TrackTile, DownloadDialog
    },
    props: {
        playlistData: Object
    },
    data() {
        return {
            //Props cannot be modified
            playlist: this.playlistData,
            //Initial loading
            loading: false,
            loadingTracks: false,
            //Add to library button
            libraryLoading: false,
            downloadDialog: false
        }
    },
    methods: {
        async playIndex(index) {
            //Load tracks
            if (this.playlist.tracks.length == 0)
                await this.loadAllTracks();
            
            this.$root.queue.source = {
                text: this.playlist.title,
                source: 'playlist',
                data: this.playlist.id
            };
            this.$root.replaceQueue(this.playlist.tracks);
            this.$root.playIndex(index);

            //Load rest of tracks on background
            if (this.playlist.tracks.length < this.playlist.trackCount) {
                this.loadAllTracks().then(() => {
                    this.$root.replaceQueue(this.playlist.tracks);
                });
            }
        },
        play() {
            this.playIndex(0);
        },
        scroll(event) {
            let loadOffset = event.target.scrollHeight - event.target.offsetHeight - 100;
            if (event.target.scrollTop > loadOffset) {
                if (!this.loadingTracks && !this.loading) this.loadTracks();
            }
        },

        //Lazy loading
        async loadTracks() {
            if (this.playlist.tracks.length >= this.playlist.trackCount) return;
            this.loadingTracks = true;

            let offset = this.playlist.tracks.length;
            let res = await this.$axios.get(`/playlist/${this.playlist.id}?start=${offset}`);
            if (res.data && res.data.tracks) {
                this.playlist.tracks.push(...res.data.tracks);
            }
            this.loadingTracks = false;
        },

        //Load all the tracks
        async loadAllTracks() {
            this.loadingTracks = true;
            let data = await this.$axios.get(`/playlist/${this.playlist.id}?full=iguess`);
            if (data && data.data && data.data.tracks) {
                this.playlist.tracks.push(...data.data.tracks.slice(this.playlist.tracks.length));
            }
            this.loadingTracks = false;
        },
        async library() {
            this.libraryLoading = true;
            await this.$axios.put(`/library/playlist?id=${this.playlist.id}`);
            this.libraryLoading = false;
            this.$root.globalSnackbar = this.$t('Added to library!');
        },

        async initialLoad() {
            //Load meta and intial tracks
            if (this.playlist.tracks.length < this.playlist.trackCount) {
                this.loading = true;
                let data = await this.$axios.get(`/playlist/${this.playlist.id}?start=0`);
                if (data && data.data && data.data.tracks) {
                    this.playlist = data.data;
                }
                this.loading = false;
            }
        },
        //On track removed
        trackRemoved(index) {
            this.playlist.tracks.splice(index, 1);
        },
        async download() {
            //Load all tracks
            if (this.playlist.tracks.length < this.playlist.trackCount) {
                await this.loadAllTracks();
            }
            this.downloadDialog = true;
        }
    },
    mounted() {
       this.initialLoad(); 
    },
    watch: {
        //Reload on playlist change from drawer
        playlistData(n, o) {
            if (n.id == o.id) return;
            this.playlist = this.playlistData;
            this.loading = false;
            this.initialLoad();
        }
    }
}
</script>
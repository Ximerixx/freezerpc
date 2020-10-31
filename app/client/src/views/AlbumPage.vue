<template>
<div>
    <v-card class='d-flex'>
        <v-img 
            :src='album.art.full' 
            :lazy-src="album.art.thumb" 
            max-height="100%"
            max-width="35vh"
            contain
        ></v-img>
        
        <div class='pl-4'>
            <v-overlay absolute :value="loading" z-index="3" opacity='0.9'>
                <v-progress-circular indeterminate></v-progress-circular>
            </v-overlay>
            <h1>{{album.title}}</h1>
            <h3>{{album.artistString}}</h3>
            <div class='mt-2' v-if='!loading'>
                <span class='text-subtitle-2'>{{album.tracks.length}} {{$t("tracks")}}</span><br>
                <span class='text-subtitle-2'>{{$t("Duration")}}: {{duration}}</span><br>
                <span class='text-subtitle-2'>{{$numberString(album.fans)}} fans</span><br>
                <span class='text-subtitle-2'>{{$t("Released")}}: {{album.releaseDate}}</span><br>
            </div>
            
            <div class='my-2'>
                <v-btn color='primary' class='mx-1' @click='play'>
                    <v-icon left>mdi-play</v-icon>
                    {{$t("Play")}}
                </v-btn>
                <v-btn color='red' class='mx-1' @click='library' :loading='libraryLoading'>
                    <v-icon left>mdi-heart</v-icon>
                    {{$t("Library")}}
                </v-btn>
                <v-btn color='green' class='mx-1' @click='download'>
                    <v-icon left>mdi-download</v-icon>
                    {{$t("Download")}}
                </v-btn>
            </div>
        </div>
    </v-card>

    <h1 class='mt-2'>Tracks</h1>
    <v-list avatar v-if='album.tracks.length > 0'>
        <div v-for='(track, index) in album.tracks' :key='track.id'>

            <!-- Disk split -->
            <div 
                v-if='index == 0 || track.diskNumber != album.tracks[index-1].diskNumber'
                class='mx-4 text-subtitle-1'
            >
                {{$t("Disk")}} {{track.diskNumber}}
            </div>

            <TrackTile :track='track' @click='playTrack(index)'></TrackTile>
        </div>
    </v-list>

    <DownloadDialog :tracks='album.tracks' v-if='downloadDialog' @close='downloadDialog = false'></DownloadDialog>

</div>
</template>

<script>
import TrackTile from '@/components/TrackTile.vue';
import DownloadDialog from '@/components/DownloadDialog.vue';

export default {
    name: 'AlbumPage',
    components: {
        TrackTile, DownloadDialog
    },
    props: {
        albumData: Object,
    },
    data() {
        return {
            //Props cannot be edited
            album: this.albumData,
            loading: false,
            libraryLoading: false,
            downloadDialog: false
        }
    },
    methods: {
        //Load album and play at index
        playTrack(index) {
            this.$root.queue.source = {
                text: this.album.title,
                source: 'album',
                data: this.album.id
            };
            this.$root.replaceQueue(this.album.tracks);
            this.$root.playIndex(index);
        },
        //Play from beggining
        play() {
            this.playTrack(0);
        },
        //Add to library
        async library() {
            this.libraryLoading = true;
            await this.$axios.put(`/library/album?id=${this.album.id}`);
            this.libraryLoading = false;
        },
        async download() {
            this.downloadDialog = true;
        }
    },
    async mounted() {
        //Load album from api if tracks and meta is missing
        if (this.album.tracks.length == 0) {
            this.loading = true;
            let data = await this.$axios.get(`/album/${this.album.id}`);
            if (data && data.data && data.data.tracks) {
                this.album = data.data;
            }
            this.loading = false;
        }
    },
    computed: {
        duration() {
            let durations = this.album.tracks.map((t) => t.duration);
            let duration = durations.reduce((a, b) => a + b, 0);
            return this.$duration(duration);
        }
    }
};


</script>
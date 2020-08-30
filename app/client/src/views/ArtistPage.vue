<template>
<div>

    <v-card class='d-flex'>
        <v-img 
            :src='artist.picture.full' 
            :lazy-src="artist.picture.thumb" 
            max-height="100%"
            max-width="35vh"
            contain
        ></v-img>
        
        <div class='pl-4'>
            <v-overlay absolute :value="loading" z-index="3" opacity='0.9'>
                <v-progress-circular indeterminate></v-progress-circular>
            </v-overlay>
            <h1>{{artist.name}}</h1>
            <div class='mt-2' v-if='!loading'>
                <span class='text-subtitle-2'>{{artist.albumCount}} albums</span><br>
                <span class='text-subtitle-2'>{{$numberString(artist.fans)}} fans</span><br>
            </div>
            
            <div class='my-2'>
                <v-btn color='primary' class='mx-1' @click='play'>
                    <v-icon left>mdi-play</v-icon>
                    Play top
                </v-btn>
                <v-btn color='red' class='mx-1' @click='library' :loading='libraryLoading'>
                    <v-icon left>mdi-heart</v-icon>
                    Library
                </v-btn>
            </div>
        </div>
    </v-card>

    <h1 class='my-2'>Top tracks</h1>
    <v-list class='overflow-y-auto' height="300px">
        <div
            v-for='(track, index) in artist.topTracks'
            :key='"top-" + track.id'
        >
            <TrackTile
                v-if='index < 3 || (index >= 3 && allTopTracks)'
                :track='track'
                @click='playIndex(index)'
            ></TrackTile>
            
            <v-list-item v-if='!allTopTracks && index == 3' @click='allTopTracks = true'>
                <v-list-item-title>Show all top tracks</v-list-item-title>
            </v-list-item>

        </div>
        
    </v-list>

    <!-- Normal albums -->
    <h1 class='my-2'>Albums</h1>
    <v-list class='overflow-y-auto' style='max-height: 400px' @scroll.native="scroll">
        <div
        v-for='(album, index) in artist.albums'
        :key='"n" + album.id'>

            <AlbumTile
                v-if='(index < 3 || (index >= 3 && allAlbums)) && album.type == "album"'
                :album='album'
            ></AlbumTile>
            
            <!-- Show all albums -->
            <v-list-item v-if='!allAlbums && index == 3' @click='allAlbums = true'>
                <v-list-item-title>Show all albums</v-list-item-title>
            </v-list-item>

        </div>
        <!-- Loading -->
        <div class='text-center my-2' v-if='loadingMore && allAlbums'>
            <v-progress-circular indeterminate></v-progress-circular>
        </div>
    </v-list>

    <!-- Singles -->
    <h1 class='my-2'>Singles</h1>
    <v-list class='overflow-y-auto' style='max-height: 400px' @scroll.native="scroll">
        <div
        v-for='(album, index) in artist.albums'
        :key='"n" + album.id'>

            <AlbumTile
                v-if='(index < 3 || (index >= 3 && allSingles)) && album.type == "single"'
                :album='album'
            ></AlbumTile>
            
            <!-- Show all albums -->
            <v-list-item v-if='!allSingles && index == 3' @click='showAllSingles'>
                <v-list-item-title>Show all singles</v-list-item-title>
            </v-list-item>

        </div>
        <!-- Loading -->
        <div class='text-center my-2' v-if='loadingMore && allSingles'>
            <v-progress-circular indeterminate></v-progress-circular>
        </div>
    </v-list>

    <!-- TODO: Featured in -->

</div>
</template>

<script>
import TrackTile from '@/components/TrackTile.vue';
import AlbumTile from '@/components/AlbumTile.vue';

export default {
    name: 'ArtistPage',
    components: {
        TrackTile, AlbumTile
    },
    data() {
        return {
            //Because props are const
            artist: this.artistData,
            loading: false,
            libraryLoading: false,
            allTopTracks: false,
            loadingMore: false,
            allAlbums: false,
            allSingles: false
        }
    },
    props: {
        artistData: Object
    },
    methods: {
        playIndex(index) {
            this.$root.queue.source = {
                text: this.artist.name,
                source: 'top',
                data: this.artist.id
            };
            this.$root.replaceQueue(this.artist.topTracks);
            this.$root.playIndex(index);
        },
        play() {
            this.playIndex(0);
        },
        //Add to library
        async library() {
            this.libraryLoading = true;
            await this.$axios.put(`/library/artist?id=${this.artist.id}`);
            this.libraryLoading = false;
        },
        async load() {
            //Load meta and tracks
            if (this.artist.topTracks.length == 0) {
                this.loading = true;
                let data = await this.$axios.get(`/artist/${this.artist.id}`);
                if (data && data.data && data.data.topTracks) {
                    this.artist = data.data;
                }
                this.loading = false;
            }

            //Load page on background
            this.loadMoreAlbums();
        },
        async loadMoreAlbums() {
            if (this.artist.albumCount <= this.artist.albums.length) return;
            this.loadingMore = true;

            //Load more albums from API
            let res = await this.$axios.get(`/albums/${this.artist.id}?start=${this.artist.albums.length}`);
            if (res.data) {
                this.artist.albums.push(...res.data);
            }

            this.loadingMore = false;
        },
        showAllSingles() {
            this.allSingles = true;
            this.loadMoreAlbums();
        },
        //On scroll load more albums
        scroll(event) {
            if (!this.allAlbums && !this.allSingles) return;
            
            let loadOffset = event.target.scrollHeight - event.target.offsetHeight - 150;
            if (event.target.scrollTop > loadOffset) {
                if (!this.loadingMore && !this.loading) this.loadMoreAlbums();
            }
        }
    },
    async mounted() {
        this.load();
    },
    watch: {
        artistData(v) {
            if (v.id == this.artist.id) return;
            this.artist = v;
            this.load();
        }
    }
}
</script>
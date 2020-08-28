<template>
<v-list :height='height' class='overflow-y-auto' v-scroll.self='scroll'>
    <v-lazy
        v-for='(track, index) in tracks'
        :key='index + "t" + track.id'
        max-height="100"
    ><TrackTile :track='track' @click='play(index)' @remove='removedTrack(index)'>
        </TrackTile>
    </v-lazy>

    <div class='text-center' v-if='loading'>
        <v-progress-circular indeterminate></v-progress-circular>
    </div>
    

</v-list>
</template>

<script>
import TrackTile from '@/components/TrackTile.vue';

export default {
    name: 'LibraryTracks',
    components: {
        TrackTile
    },
    data() {
        return {
            loading: false,
            tracks: [],
            count: 0
        }
    },
    props: {
        height: String
    },
    methods: {
        scroll(event) {
            let loadOffset = event.target.scrollHeight - event.target.offsetHeight - 100;
            if (event.target.scrollTop > loadOffset) {
                if (!this.loading) this.load();
            }
        },
        //Load initial data
        initialLoad() {
            this.loading = true;
            this.$axios.get(`/library/tracks`).then((res) => {
                this.tracks = res.data.data;
                this.count = res.data.count;
                this.loading = false;
            });
        },
        //Load more tracks
        load() {
            if (this.tracks.length >= this.count) return;
            this.loading = true;
            //Library Favorites = playlist
            let id = this.$root.profile.favoritesPlaylist;
            let offset = this.tracks.length;
            this.$axios.get(`/playlist/${id}?start=${offset}`).then((res) => {
                this.tracks.push(...res.data.tracks);
                this.loading = false;
            });
        },
        //Load all tracks
        async loadAll() {
            this.loading = true;
            let id = this.$root.profile.favoritesPlaylist;
            let res = await this.$axios.get(`/playlist/${id}?full=iguess`);
            if (res.data && res.data.tracks) {
                this.tracks.push(...res.data.tracks.slice(this.tracks.length));
            }
            this.loading = false;
        },
        //Play track
        async play(index) {
            if (this.tracks.length < this.count) {
                await this.loadAll();
            }

            this.$root.queue.source = {
                text: 'Loved tracks',
                source: 'playlist',
                data: this.$root.profile.favoritesPlaylist
            };
            this.$root.replaceQueue(this.tracks);
            this.$root.playIndex(index);
        },
        removedTrack(index) {
            this.tracks.splice(index, 1);
        }
    },
    mounted() {
        this.initialLoad();
    }

}
</script>
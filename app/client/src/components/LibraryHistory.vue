<template>
<div>

    <div v-if='loading'>
        <v-progress-circular indeterminate class='ma-4'></v-progress-circular>
    </div>

    <v-list v-if='!loading'>
        <v-lazy v-for='(track, index) in tracks' :key='track.id' max-height='100'>
            <TrackTile :track='track' @click='play(index)'></TrackTile>
        </v-lazy>
    </v-list>

</div>
</template>

<script>

import TrackTile from '@/components/TrackTile.vue';

export default {
    name: 'LibraryHistory',
    components: {
        TrackTile
    },
    data() {
        return {
            loading: true,
            tracks: []
        }
    },
    methods: {
        async load() {
            this.loading = true;

            //Fetch
            let res = await this.$axios.get('/history');
            if (res.data) this.tracks = res.data;

            this.loading = false;
        },
        //Load as queue and play
        play(index) {
            this.$root.queue.source = {
                text: 'History',
                source: 'history',
                data: null
            };
            this.$root.replaceQueue(this.tracks);
            this.$root.playIndex(index);
        }
    },
    mounted() {
        //Load on start
        this.load();
    }
}
</script>
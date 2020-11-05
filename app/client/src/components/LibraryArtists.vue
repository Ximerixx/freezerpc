<template>
<v-list>

    <v-overlay v-if='loading'>
        <v-progress-circular indeterminate></v-progress-circular>
    </v-overlay>

    <v-lazy max-height="100" v-for='(artist, index) in artists' :key='artist.id'>
        <ArtistTile :artist='artist' @remove='removed(index)'></ArtistTile>
    </v-lazy>

</v-list>
</template>

<script>
import ArtistTile from '@/components/ArtistTile.vue';

export default {
    name: 'LibraryArtists',
    components: {
        ArtistTile
    },
    data() {
        return {
            artists: [],
            loading: false
        }
    },
    methods: {
        //Load data
        async load() {
            this.loading = true;
            let res = await this.$axios.get(`/library/artists`);
            if (res.data && res.data.data) {
                this.artists = res.data.data;
            }
            this.loading = false;
        },
        removed(index) {
            this.artists.splice(index, 1);
        }
    },
    mounted() {
        //Initial load
        this.load();
    }
}
</script>
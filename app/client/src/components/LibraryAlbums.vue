<template>
<v-list>

    <v-overlay v-if='loading'>
        <v-progress-circular indeterminate></v-progress-circular>
    </v-overlay>

    <v-lazy max-height="100" v-for='(album, index) in albums' :key='album.id'>
        <AlbumTile :album='album' @remove='removed(index)'></AlbumTile>
    </v-lazy>

</v-list>
</template>

<script>
import AlbumTile from '@/components/AlbumTile.vue';

export default {
    name: 'LibraryAlbums',
    data() {
        return {
            albums: [],
            loading: false
        }
    },
    methods: {
        //Load data
        async load() {
            this.loading = true;
            let res = await this.$axios.get(`/library/albums`);
            if (res.data && res.data.data) {
                this.albums = res.data.data;
            }
            this.loading = false;
        },
        removed(index) {
            this.albums.splice(index, 1);
        }
    },
    components: {
        AlbumTile
    },
    mounted() {
        //Initial load
        this.load();
    }
}
</script>
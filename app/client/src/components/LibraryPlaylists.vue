<template>
<v-list>

    <v-overlay v-if='loading'>
        <v-progress-circular indeterminate></v-progress-circular>
    </v-overlay>

    <!-- Create playlist -->
    <v-btn class='ma-2 ml-3' color='primary' @click='popup = true'>
        <v-icon left>mdi-playlist-plus</v-icon>
        {{$t("Create new playlist")}}
    </v-btn>

    <v-dialog max-width="400px" v-model='popup'>
        <PlaylistPopup @created='playlistCreated'></PlaylistPopup>
    </v-dialog>


    <v-lazy max-height="100" v-for='(playlist, index) in playlists' :key='playlist.id'>
        <PlaylistTile :playlist='playlist' @remove='removed(index)'></PlaylistTile>
    </v-lazy>

</v-list>
</template>

<script>
import PlaylistTile from '@/components/PlaylistTile.vue';
import PlaylistPopup from '@/components/PlaylistPopup.vue';

export default {
    name: 'LibraryPlaylists',
    components: {
        PlaylistTile, PlaylistPopup
    },
    data() {
        return {
            playlists: [],
            loading: false,
            popup: false
        }
    },
    methods: {
        //Load data
        async load() {
            this.loading = true;
            let res = await this.$axios.get(`/library/playlists`);
            if (res.data && res.data.data) {
                this.playlists = res.data.data;
            }
            this.loading = false;

        },
        //Playlist created, update list
        playlistCreated() {
            this.popup = false;
            this.playlists = [];
            this.load();
        },
        //On playlist remove
        removed(i) {
            this.playlists.splice(i, 1);
        }
    },
    mounted() {
        //Initial load
        this.load();
    }
}
</script>
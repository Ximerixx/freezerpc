<template>
<v-list>

    <v-overlay v-if='loading'>
        <v-progress-circular indeterminate></v-progress-circular>
    </v-overlay>

    <div class='d-flex'>
        <!-- Create playlist -->
        <v-btn class='ma-2 ml-3' color='primary' @click='popup = true'>
            <v-icon left>mdi-playlist-plus</v-icon>
            {{$t("Create new playlist")}}
        </v-btn>

        <!-- Sort -->
        <div class='mt-1 px-2 d-flex'>
            <div class='text-overline pt-1 mx-2'>
                {{playlists.length}} {{$t("Playlists")}}
            </div>
            <div style="max-width: 200px;" class='mx-2'>
                <v-select class='px-2' dense solo :items='sortTypes' @change='sort' :label='$t("Sort by")'>
                </v-select>
            </div>
            <div class='px-2' @click='reverseSort'>
                <v-btn icon>
                    <v-icon v-if='isReversed'>mdi-sort-reverse-variant</v-icon>
                    <v-icon v-if='!isReversed'>mdi-sort-variant</v-icon>
                </v-btn>
            </div>
        </div>

    </div>

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
            popup: false,

            //Sort
            isReversed: false,
            sortTypes: [
                this.$t('Date Added'),
                this.$t('Name (A-Z)'),
            ],
            unsorted: null
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
        },
        //Sort changed
        async sort(type) {
            let index = this.sortTypes.indexOf(type);
            //Copy original
            if (!this.unsorted)
                this.unsorted = JSON.parse(JSON.stringify(this.playlists));
            
            //Using indexes, so it can be translated later
            this.isReversed = false;
            switch (index) {
                //Default
                case 0:
                    this.playlists = JSON.parse(JSON.stringify(this.unsorted));
                    break;
                //Name
                case 1:
                    this.playlists = this.playlists.sort((a, b) => {return a.title.localeCompare(b.title);});
                    break;
            }
        },
        async reverseSort() {
            this.isReversed = !this.isReversed;
            this.playlists.reverse();
        },
    },
    mounted() {
        //Initial load
        this.load();
    }
}
</script>
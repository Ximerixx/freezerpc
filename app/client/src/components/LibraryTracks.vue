<template>
<div v-scroll.self='scroll'>
    <div class='px-4 pt-2 d-flex' style='max-height: 50px;'>
        <div class='text-overline px-2 pt-1'>
            {{count}} {{$t("TRACKS")}}
        </div>
        <div style="max-width: 200px;" class='d-flex mx-2'>
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

    <v-list :height='height' class='overflow-y-auto'>
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
</div>
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
            count: 0,
            sortTypes: [
                this.$t('Date Added'),
                this.$t('Name (A-Z)'),
                this.$t('Artist (A-Z)'),
                this.$t('Album (A-Z)')
            ],
            tracksUnsorted: null,
            isReversed: false
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
            this.$root.queue.source = {
                text: 'Loved tracks',
                source: 'playlist',
                data: this.$root.profile.favoritesPlaylist
            };
            this.$root.replaceQueue(this.tracks);
            this.$root.playIndex(index);

            //Load all tracks
            if (this.tracks.length < this.count) {
                this.loadAll().then(() => {
                    this.$root.replaceQueue(this.tracks);
                });
            }
        },
        //Sort changed
        async sort(type) {
            let index = this.sortTypes.indexOf(type);
            //Preload all tracks
            if (this.tracks.length < this.count) 
                await this.loadAll();
            //Copy original
            if (!this.tracksUnsorted)
                this.tracksUnsorted = JSON.parse(JSON.stringify(this.tracks));
            
            //Using indexes, so it can be translated later
            this.isReversed = false;
            switch (index) {
                //Default
                case 0:
                    this.tracks = JSON.parse(JSON.stringify(this.tracksUnsorted));
                    break;
                //Name
                case 1:
                    this.tracks = this.tracks.sort((a, b) => {return a.title.localeCompare(b.title);});
                    break;
                //Artist
                case 2:
                    this.tracks = this.tracks.sort((a, b) => {return a.artistString.localeCompare(b.artistString);});
                    break;
                //Album
                case 3:
                    this.tracks = this.tracks.sort((a, b) => {return a.album.title.localeCompare(b.album.title);});
                    break;
            }
        },
        async reverseSort() {
            //Preload tracks if not sorted yet
            if (this.tracks.length < this.count) 
                await this.sort(0);
            this.isReversed = !this.isReversed;
            this.tracks.reverse();
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
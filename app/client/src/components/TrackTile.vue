<template>
<v-list-item two-line @click='$emit("click")'>
    <v-list-item-avatar>
        <v-img :src='track.albumArt.thumb'></v-img>
    </v-list-item-avatar>
    <v-list-item-content>
        <v-list-item-title
            :class='{"primary--text": track.id == ($root.track ? $root.track : {id: null}).id}'
        >{{track.title}}</v-list-item-title>
        <v-list-item-subtitle>{{track.artistString}}</v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
        <!-- Quick add/remoev to library -->
        <v-btn @click.stop='addLibrary' icon v-if='!isLibrary'>
            <v-icon>mdi-heart</v-icon>
        </v-btn>
        <v-btn @click.stop='removeLibrary' icon v-if='isLibrary'>
            <v-icon>mdi-heart-remove</v-icon>
        </v-btn>
    </v-list-item-action>
    <v-list-item-action>
        <!-- Quick add to playlist -->
        <v-btn @click.stop='popup = true' icon>
            <v-icon>mdi-playlist-plus</v-icon>
        </v-btn>
    </v-list-item-action>
    <v-list-item-action>
        <!-- Context menu -->
        <v-menu v-model='menu' offset-y offset-x absolue>
            <template v-slot:activator="{on, attrs}">
                <v-btn v-on='on' v-bind='attrs' icon>
                    <v-icon>mdi-dots-vertical</v-icon>
                </v-btn>
            </template>
            <v-list dense>
                <!-- Play Next -->
                <v-list-item dense @click='playNext'>
                    <v-list-item-icon>
                        <v-icon>mdi-playlist-plus</v-icon>
                    </v-list-item-icon>
                    <v-list-item-content>
                        <v-list-item-title>Play next</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <!-- Add to end of queue -->
                <v-list-item dense @click='addQueue'>
                    <v-list-item-icon>
                        <v-icon>mdi-playlist-plus</v-icon>
                    </v-list-item-icon>
                    <v-list-item-content>
                        <v-list-item-title>Add to queue</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <!-- Add to library -->
                <v-list-item dense @click='addLibrary' v-if='!isLibrary'>
                    <v-list-item-icon>
                        <v-icon>mdi-heart</v-icon>
                    </v-list-item-icon>
                    <v-list-item-content>
                        <v-list-item-title>Add to library</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <!-- Remove from library -->
                <v-list-item dense @click='removeLibrary' v-if='isLibrary'>
                    <v-list-item-icon>
                        <v-icon>mdi-heart-remove</v-icon>
                    </v-list-item-icon>
                    <v-list-item-content>
                        <v-list-item-title>Remove from library</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <!-- Add to playlist -->
                <v-list-item dense @click='popup = true' v-if='!playlistId'>
                    <v-list-item-icon>
                        <v-icon>mdi-playlist-plus</v-icon>
                    </v-list-item-icon>
                    <v-list-item-content>
                        <v-list-item-title>Add to playlist</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <!-- Remove from playlist -->
                <v-list-item dense @click='removePlaylist' v-if='playlistId'>
                    <v-list-item-icon>
                        <v-icon>mdi-playlist-remove</v-icon>
                    </v-list-item-icon>
                    <v-list-item-content>
                        <v-list-item-title>Remove from playlist</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <!-- Go to album -->
                <v-list-item dense @click='goAlbum'>
                    <v-list-item-icon>
                        <v-icon>mdi-album</v-icon>
                    </v-list-item-icon>
                    <v-list-item-content>
                        <v-list-item-title>Go to "{{track.album.title}}"</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <!-- Go to artists -->
                <v-list-item 
                    dense 
                    @click='goArtist(artist)'
                    v-for="artist in track.artists"
                    :key='"ART" + artist.id'
                >
                    <v-list-item-icon>
                        <v-icon>mdi-account-music</v-icon>
                    </v-list-item-icon>
                    <v-list-item-content>
                        <v-list-item-title>Go to "{{artist.name}}"</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>

                <!-- Download -->
                <v-list-item dense @click='download'>
                    <v-list-item-icon>
                        <v-icon>mdi-download</v-icon>
                    </v-list-item-icon>
                    <v-list-item-content>
                        <v-list-item-title>Download</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>

            </v-list>
        </v-menu>
    </v-list-item-action>

    <!-- Add to playlist dialog -->
    <v-dialog max-width="400px" v-model='popup'>
        <PlaylistPopup :track='this.track' @close='popup = false'></PlaylistPopup>
    </v-dialog>

    <DownloadDialog :tracks='[track]' v-if='downloadDialog' @close='downloadDialog = false'></DownloadDialog>

</v-list-item>
</template>

<script>
import PlaylistPopup from '@/components/PlaylistPopup.vue';
import DownloadDialog from '@/components/DownloadDialog.vue';

export default {
    name: 'TrackTile',
    components: {
        PlaylistPopup, DownloadDialog
    },
    data() {
        return {
            menu: false,
            popup: false,
            downloadDialog: false,
            isLibrary: this.$root.libraryTracks.includes(this.track.id)
        }
    },
    props: {
        track: Object,
        //If specified, track can be removed
        playlistId: {
            type: String,
            default: null
        },
    },
    methods: {
        //Add track next to queue
        playNext() {
            this.$root.addTrackIndex(this.track, this.$root.queueIndex+1);
        },
        addQueue() {
            this.$root.queue.push(this.track);
        },
        addLibrary() {
            this.isLibrary = true;
            this.$root.libraryTracks.push(this.track.id);
            this.$axios.put(`/library/tracks?id=${this.track.id}`);
        },
        goAlbum() {
            this.$router.push({
                path: '/album',
                query: {album: JSON.stringify(this.track.album)}
            });
        },
        goArtist(a) {
            this.$router.push({
                path: '/artist',
                query: {artist: JSON.stringify(a)}
            });
        },
        async removeLibrary() {
            this.isLibrary = false;
            this.$root.libraryTracks.splice(this.$root.libraryTracks.indexOf(this.track.id), 1);
            await this.$axios.delete(`/library/tracks?id=${this.track.id}`);
            this.$emit('remove');
        },
        //Remove from playlist
        async removePlaylist() {
            await this.$axios.delete(`/playlist/${this.playlistId}/tracks`, {
                data: {track: this.track.id}
            });
            this.$emit('remove');
        },
        //Download track
        async download() {
            this.downloadDialog = true;
        }
    }
}
</script>
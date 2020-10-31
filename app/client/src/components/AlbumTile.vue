<template>
<div>
    <v-list-item two-line @click='click' v-if='!card'>
        <v-hover v-slot:default='{hover}'>
            <v-list-item-avatar>
                <v-img :src='album.art.thumb'></v-img>
                <v-overlay absolute :value='hover'>
                    <v-btn icon large @click.stop='play'>
                        <v-icon>mdi-play</v-icon>
                    </v-btn>
                </v-overlay>
            </v-list-item-avatar>
        </v-hover>
        
        <v-list-item-content>
            <v-list-item-title>
                {{album.title}}<span v-if='album.explicit' class='red--text text-overline pl-2'>E</span>
            </v-list-item-title>
            <v-list-item-subtitle>{{album.artistString}}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
            <!-- Context menu -->
            <v-menu v-model='menu' offset-y offset-x absolue>
                <template v-slot:activator="{on, attrs}">
                    <v-btn v-on='on' v-bind='attrs' icon>
                        <v-icon>mdi-dots-vertical</v-icon>
                    </v-btn>
                </template>
                <v-list dense>
                    <!-- Play album -->
                    <v-list-item dense @click='play'>
                        <v-list-item-icon>
                            <v-icon>mdi-play</v-icon>
                        </v-list-item-icon>
                        <v-list-item-content>
                            <v-list-item-title>{{$t("Play")}}</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                    <!-- Add to library -->
                    <v-list-item dense @click='addLibrary'>
                        <v-list-item-icon>
                            <v-icon>mdi-heart</v-icon>
                        </v-list-item-icon>
                        <v-list-item-content>
                            <v-list-item-title>{{$t("Add to library")}}</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                    <!-- Download -->
                    <v-list-item dense @click='download'>
                        <v-list-item-icon>
                            <v-icon>mdi-download</v-icon>
                        </v-list-item-icon>
                        <v-list-item-content>
                            <v-list-item-title>{{$t("Download")}}</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>

                </v-list>
            </v-menu>

        </v-list-item-action>
    </v-list-item>

    <v-card v-if='card' max-width='175px' max-height='210px' @click='click'>
         <v-hover v-slot:default='{hover}'>
            <div>

                <v-img :src='album.art.thumb'>
                </v-img>

                <v-overlay absolute :value='hover' opacity='0.5'>
                    <v-btn fab small color='white' @click.stop='play'>
                        <v-icon color='black'>mdi-play</v-icon>
                    </v-btn>
                </v-overlay>

            </div>
        </v-hover>


        <div class='pa-2 text-subtitle-2 text-center text-truncate'>{{album.title}}</div>

    </v-card>

    <DownloadDialog :tracks='album.tracks' v-if='downloadDialog' @close='downloadDialog = false'></DownloadDialog>

</div>
</template>

<script>
import DownloadDialog from '@/components/DownloadDialog.vue';

export default {
    name: 'AlbumTile',
    components: {DownloadDialog},
    data() {
        return {
            menu: false,
            hover: false,
            downloadDialog: false
        }
    },
    props: {
        album: Object,
        card: {
            type: Boolean,
            default: false
        }
    },
    methods: {
        async play() {
            let album = this.album;
            //Load album from API if tracks are missing
            if (album.tracks.length == 0) {
                let data = await this.$axios.get(`/album/${album.id}`)
                album = data.data;
            }
            //Error handling
            if (!album) return;

            this.$root.queueSource = {
                text: album.title,
                source: 'album',
                data: album.id
            };
            this.$root.replaceQueue(album.tracks);
            this.$root.playIndex(0);
        },
        //On click navigate to details
        click() {
            this.$router.push({
                path: '/album',
                query: {album: JSON.stringify(this.album)}
            });
            this.$emit('clicked')
        },
        addLibrary() {
            this.$axios.put(`/library/album?id=${this.album.id}`);
        },
        //Add to downloads
        async download() {
            //Fetch tracks if missing
            let tracks = this.album.tracks;
            if (!tracks || tracks.length == 0) {
                let data = await this.$axios.get(`/album/${this.album.id}`)
                tracks = data.data.tracks;
            }
            this.album.tracks = tracks;
            this.downloadDialog = true;
        }
    }
};

</script>
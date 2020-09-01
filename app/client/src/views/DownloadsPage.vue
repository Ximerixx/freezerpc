<template>
<div>

    <h1 class='pb-2'>Downloads</h1>

    <v-card v-if='$root.download' max-width='100%'>
        
        <v-list-item three-line>
            <v-list-item-avatar>
                <v-img :src='$root.download.track.albumArt.thumb'></v-img>
            </v-list-item-avatar>
            <v-list-item-content>
                <v-list-item-title>{{$root.download.track.title}}</v-list-item-title>
                <v-list-item-subtitle>
                    Downloaded: {{$filesize($root.download.downloaded)}} / {{$filesize($root.download.size)}}<br>
                    Path: {{$root.download.path}}
                </v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
    </v-card>

    <h1 class='pb-2'>Queue:</h1>
    <div class='text-h6 mr-4 pb-2 d-flex'>Total: {{$root.downloads.length}}
        <v-btn @click='$root.toggleDownload' class='ml-4' color='primary'>
            <div v-if='$root.downloading'>
                <v-icon>mdi-stop</v-icon>
                Stop
            </div>
            <div v-if='!$root.downloading'>
                <v-icon>mdi-download</v-icon>
                Start
            </div>
        </v-btn>
        <!-- Open dir -->
        <v-btn @click='openDir' class='ml-4' v-if='$root.settings.electron'>
            <v-icon>mdi-folder</v-icon>
            Show folder
        </v-btn>
        <!-- Delete all -->
        <v-btn @click='deleteDownload(-1)' class='ml-4' color='red'>
            <v-icon>mdi-delete</v-icon>
            Clear queue
        </v-btn>
    </div>

    <!-- Downloads -->
    <v-list dense>
        <div v-for='(download, index) in $root.downloads' :key='download.id'>
            <v-list-item dense>
                <v-list-item-avatar>
                    <v-img :src='download.track.albumArt.thumb'></v-img>
                </v-list-item-avatar>
                <v-list-item-content>
                    <v-list-item-title>{{download.track.title}}</v-list-item-title>
                    <v-list-item-subtitle>{{download.track.artistString}}</v-list-item-subtitle>
                </v-list-item-content>
                <v-liste-item-action>
                    <v-btn icon @click='deleteDownload(index)'>
                        <v-icon>mdi-delete</v-icon>
                    </v-btn>
                </v-liste-item-action>
            </v-list-item>
        </div>
    </v-list>

</div>
</template>

<script>

export default {
    name: 'DownloadsPage',
    methods: {
        //Open downloads directory using electron
        openDir() {
            const {ipcRenderer} = window.require('electron');
            ipcRenderer.send('openDownloadsDir');
        },
        //Remove download from queue
        async deleteDownload(i) {
            await this.$axios.delete(`/downloads/${i}`);
            this.$root.getDownloads();
        }
    }
}
</script>
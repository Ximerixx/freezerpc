<template>
<div>
    <v-list-item @click='click' v-if='!card' :class='{dense: tiny}'>
        <v-list-item-avatar v-if='!tiny'>
            <v-img :src='artist.picture.thumb'></v-img>
        </v-list-item-avatar>
        <v-list-item-content>
            <v-list-item-title>{{artist.name}}</v-list-item-title>
            <v-list-item-subtitle v-if='!tiny'>{{$abbreviation(artist.fans)}} fans</v-list-item-subtitle>
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
                    <!-- Add library -->
                    <v-list-item dense @click='addLibrary'>
                        <v-list-item-icon>
                            <v-icon>mdi-heart</v-icon>
                        </v-list-item-icon>
                        <v-list-item-content>
                            <v-list-item-title>Add to library</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </v-list>
            </v-menu>

        </v-list-item-action>
    </v-list-item>

    <!-- Card version -->
    <v-card max-height='200px' max-width='200px' v-if='card' @click='click'>
        <div class='d-flex justify-center'>
            <v-avatar size='150' class='ma-1'>
                <v-img :src='artist.picture.thumb'>
                </v-img>
            </v-avatar>
        </div>

        <div class='pa-2 text-subtitle-2 text-center text-truncate'>{{artist.name}}</div>
    </v-card>

</div>
</template>

<script>
export default {
    name: 'ArtistTile',
    data() {
        return {
            menu: false
        }
    },
    props: {
        artist: Object,
        card: {
            type: Boolean,
            default: false,
        },
        tiny: {
            type: Boolean,
            default: false
        }
    },
    methods: {
        addLibrary() {
            this.$axios.put(`/library/artist&id=${this.artist.id}`);
        },
        click() {
            //Navigate to details
            this.$router.push({
                path: '/artist',
                query: {artist: JSON.stringify(this.artist)}
            });
            this.$emit('clicked');
        }
    }
}

</script>
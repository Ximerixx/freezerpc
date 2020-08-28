<template>
  <v-app v-esc='closePlayer'>

    <!-- Fullscreen player overlay -->
    <v-overlay :value='showPlayer' opacity='0.97' z-index="100">
        <FullscreenPlayer @close='closePlayer' @volumeChange='volume = $root.volume'></FullscreenPlayer>
    </v-overlay>

    <!-- Drawer/Navigation -->
    <v-navigation-drawer 
      permanent 
      fixed
      app
      mini-variant
      expand-on-hover
    ><v-list nav dense>

        <!-- Profile -->
        <v-list-item two-line v-if='$root.profile && $root.profile.picture' class='miniVariant px-0'>
          <v-list-item-avatar>
            <img :src='$root.profile.picture.thumb'>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{$root.profile.name}}</v-list-item-title>
            <v-list-item-subtitle>{{$root.profile.id}}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>

        <!-- Home link -->
        <v-list-item link to='/home'>
          <v-list-item-icon>
            <v-icon>mdi-home</v-icon>
          </v-list-item-icon>
          <v-list-item-title>Home</v-list-item-title>
        </v-list-item>

        <!-- Browse link -->
        <v-list-item link to='/page?target=channels%2Fexplore'>
          <v-list-item-icon>
            <v-icon>mdi-earth</v-icon>
          </v-list-item-icon>
          <v-list-item-title>Browse</v-list-item-title>
        </v-list-item>

        <v-subheader inset>Library</v-subheader>
        <v-divider></v-divider>

        <!-- Tracks -->
        <v-list-item link to='/library/tracks'>
          <v-list-item-icon>
            <v-icon>mdi-music-note</v-icon>
          </v-list-item-icon>
          <v-list-item-title>Tracks</v-list-item-title>
        </v-list-item>

        <!-- Playlists -->
        <v-list-item link to='/library/playlists'>
          <v-list-item-icon>
            <v-icon>mdi-playlist-music</v-icon>
          </v-list-item-icon>
          <v-list-item-title>Playlists</v-list-item-title>
        </v-list-item>

        <!-- Albums -->
        <v-list-item link to='/library/albums'>
          <v-list-item-icon>
            <v-icon>mdi-album</v-icon>
          </v-list-item-icon>
          <v-list-item-title>Albums</v-list-item-title>
        </v-list-item>

        <!-- Artists -->
        <v-list-item link to='/library/artists'>
          <v-list-item-icon>
            <v-icon>mdi-account-music</v-icon>
          </v-list-item-icon>
          <v-list-item-title>Artists</v-list-item-title>
        </v-list-item>

        <v-subheader inset>More</v-subheader>
        <v-divider></v-divider>

        <!-- Settings -->
        <v-list-item link to='/settings'>
          <v-list-item-icon>
            <v-icon>mdi-cog</v-icon>
          </v-list-item-icon>
          <v-list-item-title>Settings</v-list-item-title>
        </v-list-item>

        <!-- Downloads -->
        <v-list-item link to='/downloads'>
          
          <!-- Download icon -->
          <v-list-item-icon v-if='!$root.download && $root.downloads.length == 0'>
            <v-icon>mdi-download</v-icon>
          </v-list-item-icon>

          <!-- Paused download -->
          <v-list-item-icon v-if='!$root.download && $root.downloads.length > 0'>
            <v-icon>mdi-pause</v-icon>
          </v-list-item-icon>

          <!-- Download in progress -->
          <v-list-item-icon v-if='$root.download'>
            <v-progress-circular :value='downloadPercentage' style='top: -2px' class='text-caption'>
              {{$root.downloads.length + 1}}
            </v-progress-circular>
          </v-list-item-icon>

          <v-list-item-title>Downloads</v-list-item-title>
        </v-list-item>

      </v-list>
    </v-navigation-drawer>

    <v-app-bar app dense>

      <v-btn icon @click='previous'>
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>

      <v-btn icon @click='next'>
        <v-icon>mdi-arrow-right</v-icon>
      </v-btn>

      <v-text-field 
        hide-details 
        flat 
        prepend-inner-icon="mdi-magnify" 
        single-line
        solo
        v-model="searchQuery"
        ref='searchBar'
        @keyup='search'>
      </v-text-field>
    </v-app-bar>
    
    <!-- Main -->
    <v-main>
      <v-container 
        class='overflow-y-auto' 
        fluid
        style='height: calc(100vh - 118px);'>

        <keep-alive include='Search,PlaylistPage,HomeScreen,DeezerPage'>
          <router-view></router-view>
        </keep-alive>
      </v-container>
    </v-main>
    
    <!-- Footer -->
    <v-footer fixed app height='70' class='pa-0'>

      <v-progress-linear 
        height='5' 
        :value='position'
        style='cursor: pointer;'
        class='seekbar'
        @change='seek'
        background-opacity='0'>
      </v-progress-linear>

      <v-row no-gutters align='center' ref='footer' class='ma-1'>

        <!-- No track loaded -->
        <v-col class='col-5 d-none d-sm-flex' v-if='!this.$root.track'>
          <h3 class='pl-4'>Freezer</h3>
        </v-col>

        <!-- Track Info -->
        <v-col class='d-none d-sm-flex' cols='5' v-if='this.$root.track'>
            <v-img 
              :src='$root.track.albumArt.thumb'
              height="56"
              max-width="60"
              contain>
            </v-img>
            <div class='text-truncate flex-column d-flex'>
              <span class='text-subtitle-1 pl-2 text-no-wrap'>{{this.$root.track.title}}</span>
              <span class='text-subtitle-2 pl-2 text-no-wrap'>{{this.$root.track.artistString}}</span>
            </div>
        </v-col>

        <!-- Controls -->
        <v-col class='text-center' cols='12' sm='auto'>
            <v-btn icon large @click.stop='$root.skip(-1)'>
                <v-icon>mdi-skip-previous</v-icon>
            </v-btn>
            <v-btn icon x-large @click.stop='$root.toggle'>
                <v-icon v-if='!$root.isPlaying()'>mdi-play</v-icon>
                <v-icon v-if='$root.isPlaying()'>mdi-pause</v-icon>
            </v-btn>
            <v-btn icon large @click.stop='$root.skip(1)'>
                <v-icon>mdi-skip-next</v-icon>
            </v-btn>
        </v-col>


        <!-- Right side -->
        <v-spacer></v-spacer>

        <v-col cols='0' md='auto' class='d-none d-sm-none d-md-flex justify-center px-2' v-if='this.$root.track'>
          <span class='text-subtitle-2'>
            {{$duration($root.position)}} <span class='px-4'>{{qualityText}}</span>
          </span>
        </v-col>

        <v-spacer></v-spacer>
        
        <!-- Volume -->
        <v-col cols='auto' class='d-none d-sm-flex px-2' @click.stop>

          <div style='width: 180px;' class='d-flex'>
            <v-slider 
              dense 
              hide-details 
              min='0.00' 
              max='1.00' 
              step='0.01' 
              v-model='volume' 
              :prepend-icon='$root.muted ? "mdi-volume-off" : "mdi-volume-high"'
              @click:prepend='$root.toggleMute()'
            >
              <template v-slot:append>
                  <div style='padding-top: 4px;'>
                      {{Math.round(volume * 100)}}%
                  </div>
              </template>
            </v-slider>
          </div>
            
        </v-col>

      </v-row>
    </v-footer>

  </v-app>
</template>

<style lang='scss'>
@import 'styles/scrollbar.scss';
.v-navigation-drawer__content {
    overflow-y: hidden !important;
}
</style>
<style lang='scss' scoped>
.seekbar {
  transition: none !important;
}
.seekbar .v-progress-linear__determinate {
  transition: none !important;
}
</style>

<script>
import FullscreenPlayer from '@/views/FullscreenPlayer.vue';

export default {
  name: 'App',
  components: {
    FullscreenPlayer
  },
  data () {
    return {
      volume: this.$root.volume,
      showPlayer: false,
      position: '0.00',
      searchQuery: '',
    }
  },
  methods: {
    //Hide fullscreen player overlay
    closePlayer() {
      if (this.showPlayer) this.showPlayer = false;
      this.volume = this.$root.volume;
    },
    //Navigation
    previous() {
      if (window.history.length == 3) return;
      this.$router.go(-1);
    },
    next() {
      this.$router.go(1);
    },
    search(event) {
      //KeyUp event, enter
      if (event.keyCode !== 13) return;
      this.$router.push({path: '/search', query: {q: this.searchQuery}});
    },
    seek(val) {
      this.$root.seek(Math.round((val / 100) * this.$root.duration()));
    }
  },
  computed: {
    qualityText() {
      return `${this.$root.playbackInfo.format} ${this.$root.playbackInfo.quality}`;
    },
    downloadPercentage() {
      if (!this.$root.download) return 0;
      let p = (this.$root.download.downloaded / this.$root.download.size) * 100;
      if (isNaN(p)) return 0;
      return Math.round(p);
    }
  },
  async mounted() {
    //onClick for footer
    this.$refs.footer.addEventListener('click', () => {
      if (this.$root.track) this.showPlayer = true;
    });

    // /search
    document.addEventListener('keypress', (event) => {
      if (event.keyCode != 47) return;
      this.$refs.searchBar.focus();
      setTimeout(() => {
        this.searchQuery = this.searchQuery.replace(new RegExp('/', 'g'), '');
      }, 40);
    });

    //Wait for volume to load
    if (this.$root.loadingPromise) await this.$root.loadingPromise;
    this.volume = this.$root.volume;
  },
  created() {
    //Go to login if unauthorized
    if (!this.$root.authorized) {
      this.$router.push('/login');
    }
  },
  watch: {
    volume() {
      if (this.$root.audio) this.$root.audio.volume = this.volume;
      this.$root.volume = this.volume;
    },
    //Update position
    '$root.position'() {
      this.position = (this.$root.position / this.$root.duration()) * 100;
    }
  }
};

</script>
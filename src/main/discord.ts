import { Client } from '@xhayper/discord-rpc/dist/Client'

import type { SessionMetadata } from '../types'

function throttle <T extends (...args: any[]) => unknown>(callback: T, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    if (timeout) return
    timeout = setTimeout(() => {
      timeout = undefined
      callback(...args)
    }, waitFor).unref()
  }
}

export default class Discord {
  discord = new Client({ transport: { type: 'ipc' }, clientId: '981509069309354054' })
  debouncedDiscordRPC = throttle(() => this.setDiscordRPC(), 2000)
  position: MediaPositionState | undefined = undefined
  playback: 'none' | 'paused' | 'playing' = 'none'
  session: SessionMetadata | undefined = undefined
  mediaId: number | undefined = undefined
  allowDiscordDetails = true

  constructor () {
    this.discord.on('ready', async () => {
      this.setDiscordRPC()
      this.discord.subscribe('ACTIVITY_JOIN_REQUEST', undefined)
      this.discord.subscribe('ACTIVITY_JOIN', undefined)
      this.discord.subscribe('ACTIVITY_SPECTATE', undefined)
    })

    // this.discord.on('ACTIVITY_JOIN', ({ secret }) => {
    //   window.webContents.send('w2glink', secret) // TODO
    // })

    this.loginRPC()
  }

  loginRPC () {
    this.discord.login().catch(() => {
      setTimeout(() => this.loginRPC(), 5000).unref()
    })
  }

  setDiscordRPC () {
    if (this.discord.user) {
      if (!this.session?.title) {
        this.discord.request('SET_ACTIVITY', {
          pid: process.pid,
          activity: null
        })
        return
      }

      const position = (this.position?.position ?? 0) * 1000
      const duration = (this.position?.duration ?? 0) * 1000

      const currentTime = this.position?.position ?? 0
      const timeText = `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, '0')}`

      let state = this.allowDiscordDetails ? this.session.description : 'Watching anime'
      if (this.playback === 'paused') {
        state = `⏸ Paused • ${state} (${timeText})`
      }

      const status = {
        pid: process.pid,
        activity: {
          type: 3,
          name: 'Crunchyroll',
          state,
          details: this.allowDiscordDetails ? this.session.title : 'Anime',
          timestamps: {
            start: this.allowDiscordDetails && this.position ? Date.now() - position : undefined,
            end: this.allowDiscordDetails && this.position && this.playback === 'playing' ? Date.now() + (duration - position) : undefined
          },
          assets: {
            large_image: this.allowDiscordDetails && this.session.image ? this.session.image : 'logo',
            large_text: this.allowDiscordDetails ? this.session.title : 'Anime'
          }
        }
      }
      this.discord.request('SET_ACTIVITY', status)
    }
  }
}

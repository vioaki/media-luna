import { Context } from '@koishijs/client'
import {} from 'koishi-plugin-media-luna'

import Index from './pages/index.vue'

export default (ctx: Context) => {
  ctx.page({
    name: 'Media Luna',
    path: '/media-luna',
    component: Index,
    order: 500,
  })
}

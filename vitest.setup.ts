import { beforeAll } from 'vitest'

beforeAll(() => {
  if (typeof HTMLElement !== 'undefined') {
    HTMLElement.prototype.scrollTo = function scrollTo(this: HTMLElement, opts?: ScrollToOptions) {
      if (opts && typeof opts.top === 'number') {
        this.scrollTop = opts.top
      } else {
        this.scrollTop = this.scrollHeight
      }
    }
  }
})

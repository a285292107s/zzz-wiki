import { ref } from 'vue'

const barHidden = ref(false)
const moreOpen = ref(false)

export function useBottomBar() {
  return { barHidden, moreOpen }
}

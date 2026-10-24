import { onMounted, ref } from 'vue'
import { dataVersions } from '@/data/api'

function formatSnapshotDate(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function useDataVersion() {
  const version = ref('')
  const updatedAt = ref('')

  onMounted(() => {
    void dataVersions()
      .then((v) => {
        version.value = v.live
        updatedAt.value = formatSnapshotDate(v.generated)
      })
      .catch(() => undefined)
  })

  function versionLabel(tag: string): string {
    return version.value ? `${tag} ${version.value}` : ''
  }

  return { version, updatedAt, versionLabel }
}

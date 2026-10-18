import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { restrictVaultPublishing, privateVaultView } from "./aeon-privacy.mjs"

const loaded = await loadQuartzConfig()
const config = process.env.AEON_QUARTZ_PRIVATE_VIEW === '1'
  ? privateVaultView(loaded, process.env.AEON_QUARTZ_PRIVATE_OUTPUT)
  : restrictVaultPublishing(loaded)
export default config
export const layout = await loadQuartzLayout()

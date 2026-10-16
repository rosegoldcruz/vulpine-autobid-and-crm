import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { restrictVaultPublishing } from "./aeon-privacy.mjs"

const config = restrictVaultPublishing(await loadQuartzConfig())
export default config
export const layout = await loadQuartzLayout()

#!/usr/bin/env node
import fs from 'node:fs/promises'
import {readAeonContext} from '../services/operations/src/agent-actions.mjs'
const value=await readAeonContext()
if(value.retrievalMode)throw Error('The context exporter requires direct source access.')
const target='/var/lib/vulpine-operations/aeon-context.json'
const temporary=target+'.next'
await fs.writeFile(temporary,JSON.stringify(value)+'\n',{mode:0o644})
await fs.chmod(temporary,0o644)
await fs.rename(temporary,target)
console.log(JSON.stringify({records:value.records.length,engineeringRecords:value.engineering.length,exportedAt:value.checkedAt}))

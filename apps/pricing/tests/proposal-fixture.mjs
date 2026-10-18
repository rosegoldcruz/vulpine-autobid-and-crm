import {quoteDates} from '../src/pricing.mjs';
import {verifyExemption} from '../tax-provider.mjs';
export const testEnv={OPS_SIGNING_SECRET:'test-only-secret-at-least-32-characters'};
export const address={street:'123 Test St',city:'Phoenix',state:'AZ',zip:'85001'};
export function complete(input){const state=structuredClone(input);state.version=2;state.pricingPolicy=2;Object.assign(state,quoteDates());state.supplier||='hci';state.projectInfo={apartments:state.units.reduce((n,u)=>n+u.repeat,0),mixEvidence:'Test fixture building inventory',addressEvidence:'Test fixture delivery instructions',cabinetLine:'Test cabinet line',finishBasis:'White Shaker per test fixture'};state.tax={enabled:false,address,lookup:null,exemption:verifyExemption({address,reason:'Fixture exemption',authority:'Fixture authority',document:'Fixture certificate',validFrom:'2026-01-01',validUntil:'2099-12-31'},testEnv)};return state;}

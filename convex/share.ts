import { queryGeneric } from "convex/server"
import { v } from "convex/values"
import { normalizePlate } from "./_utils"

export const getSightingLink = queryGeneric( {
  args: {
    id: v.number(),
    appBaseUrl: v.optional( v.string() ),
  },
  handler: async ( ctx, args ) => {
    const sighting = await ctx.db
      .query( "sightings" )
      .withIndex( "by_sightingId", ( q ) => q.eq( "id", args.id ) )
      .unique()
    if ( !sighting ) {
      throw new Error( `Sighting ${args.id} not found` )
    }
    const base = args.appBaseUrl?.replace( /\/$/, "" ) ?? ""
    const path = `/sighting/${sighting.id}`
    return {
      url: `${base}${path}`,
      title: `ICE Watch · ${sighting.licensePlate}`,
      description: sighting.locationAddress ?? `${sighting.latitude}, ${sighting.longitude}`,
    }
  },
} )

export const getPlateLinkData = queryGeneric( {
  args: {
    licensePlate: v.string(),
    appBaseUrl: v.optional( v.string() ),
  },
  handler: async ( ctx, args ) => {
    const normalized = normalizePlate( args.licensePlate )
    const rows = await ctx.db
      .query( "sightings" )
      .withIndex( "by_normalizedPlate", ( q ) => q.eq( "normalizedPlate", normalized ) )
      .collect()
    const base = args.appBaseUrl?.replace( /\/$/, "" ) ?? ""
    const path = `/plate/${normalized}`
    return {
      url: `${base}${path}`,
      title: `ICE Watch · Plate ${normalized}`,
      description: `${rows.length} sightings for plate ${normalized}`,
    }
  },
} )

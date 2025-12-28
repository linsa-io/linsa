import {
  type Atom,
  atom,
  reatomMap,
  type Rec,
  withConnectHook,
  withSuspenseInit,
  wrap,
} from "@reatom/core"

import {
  co,
  coValueClassFromCoValueClassOrSchema,
  type CoValueClassOrSchema,
  loadCoValue,
  type ResolveQuery,
  type ResolveQueryStrict,
  subscribeToCoValue,
} from "jazz-tools"

export const reatomJazz = <
  Schema extends CoValueClassOrSchema,
  Return extends Rec,
  const Resolve extends ResolveQuery<Schema> = true,
>(options: {
  schema: Schema
  resolve?: ResolveQueryStrict<Schema, Resolve>
  create: (api: {
    loaded: co.loaded<Schema, Resolve>
    name: string
    target: Atom<{ co: co.loaded<Schema, Resolve> }>
  }) => Return
  onUnauthorized?: () => void
  onUnavailable?: () => void
  name?: string
}) => {
  const { create, resolve, onUnauthorized, onUnavailable, name = "coValue" } =
    options

  type AtomState = Return & { id: string; co: co.loaded<Schema, Resolve> }

  const cache = reatomMap<string, Atom<AtomState> & { id: string }>(
    undefined,
    `${name}._cache`
  )

  return (id: string) => {
    const factoryName = `${name}.${id}`
    return cache.getOrCreate(factoryName, () => {
      const stateAtom = atom(async () => {
        return loadCoValue(
          coValueClassFromCoValueClassOrSchema(options.schema),
          id,
          // @ts-expect-error resolve types
          { resolve }
        )
          .then(
            wrap((result) => {
              if (result.$isLoaded) {
                const loaded = result as co.loaded<Schema, Resolve>
                const factoryReturn = create({
                  loaded,
                  name: factoryName,
                  target: stateAtom,
                })
                return Object.assign(factoryReturn, { id, co: loaded })
              } else {
                throw new Error(`Failed to load ${factoryName}`)
              }
            })
          )
          .catch(
            wrap((error) => {
              throw new Error(`Failed to build ${factoryName}: ${error}`)
            })
          )
      }, `${name}.loaded`).extend(
        withSuspenseInit(),
        withConnectHook((target) => {
          return subscribeToCoValue(
            coValueClassFromCoValueClassOrSchema(options.schema),
            id,
            {
              // @ts-expect-error resolve types
              resolve,
              onUnauthorized: wrap(() => onUnauthorized?.()),
              onUnavailable: wrap(() => onUnavailable?.()),
            },
            wrap((loaded: co.loaded<Schema, Resolve>) => {
              const factoryReturn = create({
                loaded,
                name: factoryName,
                target,
              })
              target.set(Object.assign(factoryReturn, { id, co: loaded }))
            })
          )
        }),
        () => ({ id })
      )
      return stateAtom
    })
  }
}

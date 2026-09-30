import { describe, expect, it } from 'vitest'
import { projectData } from '../test/projectData'
import manifest from './wikiImages.json'
import { WIKI_CREDITS, wikiImage, wikiImageFiles, wikiTexture } from './wikiImages'

const data = projectData()

describe('images du wiki', () => {
  it('illustre les 40 mutations et les crops de base (sauf ceux absents du wiki)', () => {
    for (const mutation of data.mutations) expect(wikiImage(mutation.name), mutation.name).not.toBeNull()
    const missing = data.baseCrops.filter((crop) => wikiImage(crop.name) === null).map((crop) => crop.name)
    expect(missing).toEqual(['Fire'])
  })

  it('a une image pour les icônes des upgrades et les vitres du menu', () => {
    for (const upgrade of data.mechanics.greenhouseUpgrades.items) expect(wikiImage(upgrade.icon), upgrade.icon).not.toBeNull()
    for (const pane of ['Gray', 'Lime', 'Yellow', 'Red']) expect(wikiImage(`${pane} Stained Glass Pane`)).not.toBeNull()
  })

  it('trouve chaque fichier du manifeste dans src/assets/wiki', () => {
    for (const [name, file] of Object.entries(manifest.images)) expect(wikiImage(name), `${name} → ${file}`).not.toBeNull()
    expect(wikiImage('Objet inconnu')).toBeNull()
  })

  it('a une texture à plat pour chaque sol', () => {
    for (const surface of data.surfaces) expect(wikiTexture(surface), surface).not.toBeNull()
    expect(wikiTexture('Sol inconnu')).toBeNull()
  })

  it('garde la source et la licence pour les crédits', () => {
    expect(WIKI_CREDITS).toMatchObject({ source: 'Hypixel SkyBlock Wiki (Fandom)', license: 'CC-BY-SA' })
    expect(wikiImageFiles()[0]?.page).toMatch(/^https:\/\/hypixel-skyblock\.fandom\.com\/wiki\/File:/)
  })
})

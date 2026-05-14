import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'map_zones'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('navigation_direction', 255).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('navigation_direction')
    })
  }
}

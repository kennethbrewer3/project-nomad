import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'map_zones'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('zone_type', 30).notNullable()
      table.json('geometry').notNullable()
      table.string('stroke_color', 7).notNullable().defaultTo('#2563eb')
      table.string('fill_color', 7).nullable()
      table.integer('stroke_width').notNullable().defaultTo(2)
      table.float('fill_opacity').notNullable().defaultTo(0.2)
      table.boolean('visible').notNullable().defaultTo(true)
      table.text('notes').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

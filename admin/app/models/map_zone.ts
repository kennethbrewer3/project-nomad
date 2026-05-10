import { DateTime } from 'luxon'
import { BaseModel, SnakeCaseNamingStrategy, column } from '@adonisjs/lucid/orm'

export default class MapZone extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare zone_type: string

  @column()
  declare geometry: unknown

  @column()
  declare stroke_color: string

  @column()
  declare fill_color: string | null

  @column()
  declare stroke_width: number

  @column()
  declare fill_opacity: number

  @column()
  declare visible: boolean

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime
}

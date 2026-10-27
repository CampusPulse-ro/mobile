import type { Room } from './api'

/** Rooms by building, then code; rooms with no known building last. "B10" comes after "B9". */
export function sortRooms(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    if (a.building !== b.building) {
      if (a.building === null) return 1
      if (b.building === null) return -1
      return a.building.localeCompare(b.building)
    }
    return a.code.localeCompare(b.code, undefined, { numeric: true })
  })
}

/** Sorted rooms as list sections, one per building; `other` titles the rooms with none. */
export function roomSections(sorted: Room[], other: string): { title: string; data: Room[] }[] {
  const sections: { title: string; data: Room[] }[] = []
  for (const room of sorted) {
    const title = room.building || other
    const last = sections[sections.length - 1]
    if (last && last.title === title) last.data.push(room)
    else sections.push({ title, data: [room] })
  }
  return sections
}

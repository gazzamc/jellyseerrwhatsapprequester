const messages = () => {
   const prefix = "🤖 Beep Boot Beep... "
   return {
      NO_TERM: `${prefix} No search term found!!`,
      INVALID_SEL: `${prefix} Does not compute, please enter a value within the range specified!!`,
      BOT_READY: `${prefix} Request Bot Ready!!`,
      SEARCH_INVALID: `${prefix} Request Bot Ready!!`,
      REQ_SUCCESS: (item) => {
         return `${prefix} "${item.title || item.name}" has been requested successfully!`
      },
      REQ_FAIL: (item) => {
         return `${prefix} Request for ${item.title || item.name}" has failed!`
      },
      JELLYSEERR_FAIL: (err) => {
         return `${prefix} Something went wrong! - ${err}`
      },
      REQ_CHOICE: (results) => {
         return `${prefix} Choose wisely from 1 - ${results.length}`
      },
      REQ_NO_ITEM: (type, searchTerm) => {
         return `${prefix} No items found for term '${searchTerm}', are you sure it's a '${type}'?`
      }
   }
}

module.exports = messages
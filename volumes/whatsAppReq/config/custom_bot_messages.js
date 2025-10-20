const messages = () => {
  const prefix = '🤖 Beep Boot Beep... ';
  return {
    NO_TERM: `${prefix} No search term found!!`,
    INVALID_SEL: `${prefix} Does not compute, please enter a value within the range specified!!`,
    BOT_USAGE: undefined, // Use Default
    BOT_READY: (usage) => usage,
    REQ_SUCCESS: (item, responseText) => {
      let message = '';
      if (responseText) {
        message += responseText;
        message += `${prefix} "${item.title || item.name}" has been auto selected and requested successfully!`;
      } else {
        message = `${prefix} "${item.title || item.name}" has been requested successfully!`;
      }
      return message;
    },
    REQ_FAIL: (item) => {
      return `${prefix} Request for ${item.title || item.name}" has failed!`;
    },
    JELLYSEERR_FAIL: (err) => {
      return `${prefix} Something went wrong! - Contact a human - error code ${err.response.status}`;
    },
    REQ_CHOICE: (results) => {
      return `${prefix} Choose wisely from 1 - ${results.length}`;
    },
    REQ_NO_ITEM: (type, searchTerm, isDefault) => {
      let message = `${prefix} No items found for term *"${searchTerm}"*, are you sure it's a '${type}'?`;
      if (isDefault) {
        message = `${prefix} No items found for term *"${searchTerm}"* using the default type *"movie"*, please provide a type for more accurate results?`;
      }
      return message;
    },
  };
};

module.exports = messages;


/**
  * v5008.js
  * Utility functions for parsing v5008 messages
  * @param {Buffer} message - The MQTT message buffer.
  * @returns {Object} Parsed JSON object. 
  * @author Dale.lai
  * @version 1.0.0
  * @date 2025-08-20
  * 
  * Message Format:
*/

export function V6800ToJson(topic, message) {

    // Validate message
    if (!message || typeof message.toString !== 'function') {
        throw new Error('Invalid message: message is undefined or does not have a toString method');
    }

    let jsonObject;

    try {
        // Parse the JSON string into a JSON object
        jsonObject = JSON.parse(message.toString());
    } catch (error) {
        throw new Error(`Failed to parse JSON: ${error.message}`);
    }

    return jsonObject;

}
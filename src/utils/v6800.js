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
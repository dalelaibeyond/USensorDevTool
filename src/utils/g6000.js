

/**
  * g6000.js
  * Utility functions for parsing v5008 messages
  * @param {Buffer} message - The MQTT message buffer.
  * @returns {Object} Parsed JSON object. 
  * @author Dale.lai
  * @version 1.0.0
  * @date 2025-08-22
  * 
  * Message Format:
  * 
  * HEART_BEAT
  * [CCCC or CBCB][hub_id(4B)][hub_fm_ver(4B)][hub_ip(4B)][reserved(4B)][output_power][freq_second][msg_no(4B)]
  * 
  * TAG_UPDATE
  * [AB] [tag_num] ([tag_id(4B) + ant_no] x tag_num) [year(2B)][month][day][hour][minute][second] [msg_no(4B)]
  * [CF] [tag_num] ([tag_id(8B) + ant_no] x tag_num) [year(2B)][month][day][hour][minute][second] [msg_no(4B)]
  * 
  * CMD_SET_CFG
  * [E9][cfg_type][cfg_value]                    
  * 
  * CMD_SET_TIMESTAMP                    
  * [E1][year(2B)][month][day][hour][minute][second]
  * 
  * CMD_SET_TIMESTAMP_RESPONSE
  * [E7FF][hub_ip(4B)][hub_id(4B)][year(2B)][month][day][hour][minute][second][msg_no(4B)]
  * 
  * CMD_SET_CFG_RESPONSE
  * [E9FF][hub_ip(4B)][hub_id(4B)][reserved(4B)][output_power][freq_second][msg_no]
  *
  * 
  *cfg_type:
  *0x05  output_power, range: [20-33] db
  *0x06  freq_second, range: [02-06] seconds
  *
  * 
*/


export function G6000ToJson(topic, message) {

    // Validate message
    if (!message || typeof message.toString !== 'function') {
        throw new Error('Invalid message: message is undefined or does not have a toString method');
    }

    //Convert to hex string (uppercase)
    const msg_raw = message.toString('hex').toUpperCase();


    //Get message ID (first byte, 2 hex chars)
    const msg_id = msg_raw.slice(0, 2);

    // Helper to read hex substrings as numbers or strings
    const readHex = (str, start, len) => str.slice(start, start + len);
    const readNum = (str, start, len) => parseInt(str.slice(start, start + len), 16);
    const readIP  = (sec1, sec2, sec3, sec4) => { return [sec1, sec2, sec3, sec4].join('.');}
    //const readMac = (sec1, sec2, sec3, sec4, sec5, sec6) => { return [sec1, sec2, sec3, sec4, sec5, sec6].join('.');}
    const readTime = (year, month, day, hour, minute, second) => {
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    };



    let offset = 0;
    let result = { msg_raw /*, msg_id*/ };

    switch (msg_id) {
        case 'CC':  
        case 'CB':
            // HEART_BEAT
            result = {
                ...result,
                //msg_id,
                msg_format: '[CCCC or CBCB][hub_id(4B)][hub_fm_ver(4B)][hub_ip(4B)][reserved(4B)][output_power][freq_second][msg_no(4B)]',
                msg_type: 'HEART_BEAT',
                hub_id: readNum(msg_raw, 4, 8).toString(), // 4 bytes hub_id
                hub_fm_ver: readNum(msg_raw, 12, 8).toString(),
                hub_ip: readIP(
                    readNum(msg_raw, 20, 2),
                    readNum(msg_raw, 22, 2),
                    readNum(msg_raw, 24, 2),
                    readNum(msg_raw, 26, 2)
                ),
                reserved: readHex(msg_raw, 28, 8), // 4 bytes reserved
                output_power: readNum(msg_raw, 36, 2), // Example field
                freq_second: readNum(msg_raw, 38, 2), // Example field
                msg_no: readHex(msg_raw, 40, 8) // Example field
            };
            break;
        case 'AB': {
            // TAG_UPDATE
            const cfg_tag_num = readNum(msg_raw, 2, 2);
            const cfg_tags = [];
            offset = 4; // Start after msg_id and tag_num

            for (let i = 0; i < cfg_tag_num; i++) {
                const tag_id = readHex(msg_raw, offset, 8); // 4 bytes tag_id
                const ant_no = readNum(msg_raw, offset + 8, 2); // 1 byte ant_no
                cfg_tags.push({ tag_id, ant_no });
                offset += 10; // Move to next tag (8 + 2)
            }

            result = {
                ...result,
                msg_format: '[AB][tag_num][tag_id(4B) + ant_no][year(2B)][month][day][hour][minute][second][msg_no(4B)]',
                msg_type: 'TAG_UPDATE',
                tag_num:cfg_tag_num,
                tags:cfg_tags,
                timestamp: readTime(
                    readNum(msg_raw, offset, 4), // year
                    readNum(msg_raw, offset + 4, 2), // month
                    readNum(msg_raw, offset + 6, 2), // day
                    readNum(msg_raw, offset + 8, 2), // hour
                    readNum(msg_raw, offset + 10, 2), // minute
                    readNum(msg_raw, offset + 12, 2)  // second
                ),
                msg_no: readHex(msg_raw, offset + 14, 8) // msg_no
            };
            break;
        }
        case 'CF': {
            // TAG_UPDATE with different format
            const cf_tag_num = readNum(msg_raw, 2, 2);
            const cf_tags = [];
            offset = 4; // Start after msg_id and tag_num

            for (let i = 0; i < cf_tag_num; i++) {
                const tag_id = readHex(msg_raw, offset, 16); // 8 bytes tag_id
                const ant_no = readNum(msg_raw, offset + 16, 2); // 1 byte ant_no
                cf_tags.push({ tag_id, ant_no });
                offset += 18; // Move to next tag (16 + 2)
            }

            result = {
                ...result,
                msg_format: '[CF][tag_num][tag_id(8B) + ant_no][year(2B)][month][day][hour][minute][second][msg_no(4B)]',
                msg_type: 'TAG_UPDATE',
                tag_num: cf_tag_num,
                tags: cf_tags,
                timestamp: readTime(
                    readNum(msg_raw, offset, 4), // year
                    readNum(msg_raw, offset + 4, 2), // month
                    readNum(msg_raw, offset + 6, 2), // day
                    readNum(msg_raw, offset + 8, 2), // hour
                    readNum(msg_raw, offset + 10, 2), // minute
                    readNum(msg_raw, offset + 12, 2)  // second
                ),
                msg_no: readHex(msg_raw, offset + 14, 8) // msg_no
            };
            break;
        }
        case 'E9': {
            const sub_msg_id = readHex(msg_raw, 2, 2);
            if (sub_msg_id !== 'FF') {
                throw new Error(`Unknown sub-message ID: ${sub_msg_id}`);
            }

            // CMD_SET_CFG_RESPONSE
            result = {
                ...result,
                //msg_id,
                msg_format: '[E9FF][hub_ip(4B)][hub_id(4B)][reserved(4B)][output_power][freq_second][msg_no]',
                msg_type: 'CMD_SET_CFG_RESPONSE',
                hub_ip: readIP(
                    readNum(msg_raw, 4, 2),
                    readNum(msg_raw, 6, 2),
                    readNum(msg_raw, 8, 2),
                    readNum(msg_raw, 10, 2)
                ),
                hub_id: readNum(msg_raw, 12, 8).toString(), // 4 bytes hub_id
                reserved: readHex(msg_raw, 20, 8), // 4 bytes reserved
                output_power: readNum(msg_raw, 28, 2), // Example field
                freq_second: readNum(msg_raw, 30, 2), // Example field
                msg_no: readHex(msg_raw, 32, 8) // Example field
            };
            break;
        }
        case 'E7': {
            // CMD_SET_TIMESTAMP_RESPONSE
            const sub_msg_id = readHex(msg_raw, 2, 2);
            if (sub_msg_id !== 'FF') {
                throw new Error(`Unknown sub-message ID: ${sub_msg_id}`);
            }
            result = {
                ...result,
                msg_format: '[E7FF][hub_ip(4B)][hub_id(4B)][year(2B)][month][day][hour][minute][second][msg_no(4B)]',
                msg_type: 'CMD_SET_TIMESTAMP_RESPONSE',
                //msg_id,
                hub_ip: readIP(
                    readNum(msg_raw, 4, 2),
                    readNum(msg_raw, 6, 2),
                    readNum(msg_raw, 8, 2),
                    readNum(msg_raw, 10, 2)
                ),
                hub_id: readNum(msg_raw, 12, 8).toString(), // 4 bytes hub_id
                timestamp: readTime(
                    readNum(msg_raw, 20, 4), // year
                    readNum(msg_raw, 24, 2), // month
                    readNum(msg_raw, 26, 2), // day
                    readNum(msg_raw, 28, 2), // hour
                    readNum(msg_raw, 30, 2), // minute
                    readNum(msg_raw, 32, 2)  // second
                ),
                msg_no: readHex(msg_raw, 34, 8) // msg_no
            };
            break;
        }


        default:
            throw new Error(`Unknown message ID: ${msg_id}`);
    }

    return result;

}
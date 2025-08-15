/**
 * Parse an MQTT message buffer according to the provided message format.
 * @param {Buffer} message - The MQTT message buffer.
 * @returns {Object} Parsed JSON object.
 */
export function V5008ToJson(topic, message) {

  // 1. Convert to hex string (uppercase)
  const msg_raw = message.toString('hex').toUpperCase();
 
  //console.log(`Info | [${getLocalDateTime()}][${topic}] ${msg_raw}`);

  // 2. Get message ID (first byte, 2 hex chars)
  const msg_id = msg_raw.slice(0, 2);

  // Helper to read hex substrings as numbers or strings
  const readHex = (str, start, len) => str.slice(start, start + len);
  const readNum = (str, start, len) => parseInt(str.slice(start, start + len), 16);

  let offset = 0;
  let result = { msg_raw /*, msg_id*/ };

  // 3. Parse by message ID using switch-case
  switch (msg_id) {
    case 'CB':
    case 'CC': {
      result.msg_format = '[CB or CC] [mod_add + mod_id(4B) + u_num] x 5';
      offset = 2;
      result.msg_type = 'HEART_BEAT';
      result.sections = [];
      for (let i = 0; i < 5 && offset + 11 <= msg_raw.length; i++) {
        const mod_add = readNum(msg_raw, offset, 2);
        const mod_id = readNum(msg_raw, offset + 2, 8).toString(); // Convert to decimal string
        const u_num = readNum(msg_raw, offset + 10, 2);
        result.sections.push({ mod_add, mod_id, u_num });
        offset += 12;
      }
      break;
    }
    case 'BB': {
      result.msg_format = '[BB][mod_add][mod_id(4B)][Reserved][u_num][u_tag_num][u_no + u_alarm + u_tag(4B)] x u_tag_num';
      offset = 2;
      const mod_add = readNum(msg_raw, offset, 2);
      const mod_id = readNum(msg_raw, offset + 2, 8).toString(); // Convert to decimal string
      const reserved = readHex(msg_raw, offset + 10, 2);
      const u_num = readNum(msg_raw, offset + 12, 2);
      const u_tag_num = readNum(msg_raw, offset + 14, 2);
      offset += 16;
      const u_sensor_data = [];
      for (let i = 0; i < u_tag_num && offset + 10 <= msg_raw.length; i++) {
        const u_no = readNum(msg_raw, offset, 2); // Correctly parse u_no
        const u_alarm = readNum(msg_raw, offset + 2, 2); // Correctly parse u_alarm
        const u_tag = readHex(msg_raw, offset + 4, 8); // Correctly parse u_tag
        u_sensor_data.push({ u_no, u_alarm, u_tag });
        offset += 12; // Correctly increment offset to process the next data point
      }
      result.msg_type = 'TAG_UPDATE';
      result.mod_add = mod_add;
      result.mod_id = mod_id;
      result.u_num = u_num;
      result.u_tag_num = u_tag_num;
      result.u_sensor_data = u_sensor_data;
      break;
    }
    case '01':
    case '02':
    case '03':
    case '04':
    case '05': {
      result.msg_format = '[mod_add][mod_id(4B)][th_add + th_temp(4B) + th_hum(4B)] x 6';
      offset = 0;
      const mod_add = readNum(msg_raw, offset, 2);
      const mod_id = readNum(msg_raw, offset + 2, 8).toString(); // Convert to decimal string
      offset += 10;
      const th_sensor_data = [];
      for (let i = 0; i < 6 && offset + 10 <= msg_raw.length; i++) { // Adjusted condition to ensure all 6 data points are processed
        const th_add = readNum(msg_raw, offset, 2).toString(); // Correctly parse th_add
        const th_temp_int = readNum(msg_raw, offset + 2, 2); // First byte: integer part of temperature
        const th_temp_frac = readNum(msg_raw, offset + 4, 2); // Second byte: fractional part of temperature
        const th_temp = parseFloat(`${th_temp_int}.${th_temp_frac.toString().padStart(2, '0')}`); // Combine to form float
        const th_hum_int = readNum(msg_raw, offset + 6, 2); // First byte: integer part of humidity
        const th_hum_frac = readNum(msg_raw, offset + 8, 2); // Second byte: fractional part of humidity
        const th_hum = parseFloat(`${th_hum_int}.${th_hum_frac.toString().padStart(2, '0')}`); // Combine to form float
        th_sensor_data.push({ th_add, th_temp, th_hum });
        offset += 10; // Correctly increment offset to process the next data point
      }
      result.msg_type = 'TH_UPDATE';
      result.mod_add = mod_add;
      result.mod_id = mod_id;
      result.th_sensor_data = th_sensor_data;
      break;
    }
    case '0A':
    case '0B':
    case '0C': {
      result.msg_format = '[mod_add][mod_id(4B)][th_add + ns_level(4B)] x 3';
      offset = 0;
      const mod_add = readNum(msg_raw, offset, 2);
      const mod_id = readNum(msg_raw, offset + 2, 8).toString(); // Convert to decimal string
      offset += 10;
      const ns_sensor_data = [];
      for (let i = 0; i < 3 && offset + 10 <= msg_raw.length; i++) {
        const ns_add = readHex(msg_raw, offset, 2);
        const ns_level = parseInt(readHex(msg_raw, offset + 2, 8), 16) / 100;
        ns_sensor_data.push({ ns_add, ns_level });
        offset += 10;
      }
      result.msg_type = 'NS_UPDATE';
      result.mod_add = mod_add;
      result.mod_id = mod_id;
      result.ns_sensor_data = ns_sensor_data;
      break;
    }
    case 'BA': {
      // DR_UPDATE: [BA][mod_add][mod_id(4B)][dr_status]
      offset = 2;
      const mod_add = readNum(msg_raw, offset, 2);
      const mod_id = readNum(msg_raw, offset + 2, 8).toString(); // Convert to decimal string
      const dr_status = readNum(msg_raw, offset + 10, 2);
      result.msg_type = 'DR_UPDATE';
      result.mod_add = mod_add;
      result.mod_id = mod_id;
      result.dr_status = dr_status;
      break;
    }
    case 'EF': {
      // DEVICE_UPDATE: 
      offset = 2;
      const subType = readHex(msg_raw, offset, 2);
      offset += 2;
      if (subType === '01') {
        const hd_type = readNum(msg_raw, offset, 4).toString(); // Parse hd_type (2 bytes)
        const hd_fm_ver = readNum(msg_raw, offset + 4, 8).toString(); // Parse hd_fm_ver (4 bytes)
        const hd_ip = [
          readNum(msg_raw, offset + 12, 2),
          readNum(msg_raw, offset + 14, 2),
          readNum(msg_raw, offset + 16, 2),
          readNum(msg_raw, offset + 18, 2),
        ].join('.'); // Convert to IPv4 format
        const hd_mask = [
          readNum(msg_raw, offset + 20, 2),
          readNum(msg_raw, offset + 22, 2),
          readNum(msg_raw, offset + 24, 2),
          readNum(msg_raw, offset + 26, 2),
        ].join('.'); // Convert to IPv4 format
        const hd_gateway = [
          readNum(msg_raw, offset + 28, 2),
          readNum(msg_raw, offset + 30, 2),
          readNum(msg_raw, offset + 32, 2),
          readNum(msg_raw, offset + 34, 2),
        ].join('.'); // Convert to IPv4 format
        const hd_mac = [
          readHex(msg_raw, offset + 36, 2),
          readHex(msg_raw, offset + 38, 2),
          readHex(msg_raw, offset + 40, 2),
          readHex(msg_raw, offset + 42, 2),
          readHex(msg_raw, offset + 44, 2),
          readHex(msg_raw, offset + 46, 2),
        ].join(':'); // Convert to MAC address format

        result.msg_format = '[EF][01][hd_type(2B)][hd_fm_ver(4B)][hd_ip(4B)][hd_mask(4B)][hd_gateway(4B)][hd_mac(6B)]';
        result.msg_type = 'DEVICE_UPDATE';
        result.subType = 'gateway'; // 01 - gateway
        result.hd_type = hd_type;
        result.hd_fm_ver = hd_fm_ver;
        result.hd_ip = hd_ip;
        result.hd_mask = hd_mask;
        result.hd_gateway = hd_gateway;
        result.hd_mac = hd_mac;
      } else if (subType === '02') {
        result.msg_format = '[EF][02][mod_add + fm_ver(6B)] x (until the rest bytes length < 7)';
        result.msg_type = 'DEVICE_UPDATE';
        result.subType = 'u_module'; // 02 - module
        result.sections = [];
        while (offset + 14 <= msg_raw.length) {
          const mod_add = readNum(msg_raw, offset, 2);
          const m_fm_ver = readHex(msg_raw, offset + 2, 12);
          result.sections.push({ mod_add, m_fm_ver });
          offset += 14;
        }
      }
      break;
    }
    default: {
      result.msg_raw = msg_raw;
      result.msg_type = 'UNKNOWN';
      break;
    }
  }

  return result;
}


// Helper function to get local date and time in ISO format
// This function returns the current local date and time in ISO format with milliseconds
function getLocalDateTime() {
    const localDate = new Date();
    // Manually adjust to local timezone by adjusting for the offset
    const localDateTime = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000);
    // Convert to ISO string, including milliseconds, and add 'Z' to indicate it's in UTC
    return localDateTime.toISOString();
}
  
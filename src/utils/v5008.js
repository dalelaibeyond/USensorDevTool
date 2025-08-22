
/**
  * v5008.js
  * Utility functions for parsing v5008 messages
  * @param {Buffer} message - The MQTT message buffer.
  * @returns {Object} Parsed JSON object. 
  * @author Dale.lai
  * @version 1.0.0
  * @date 2025-08-1
  * 
  * Message Format:
  * HEART_BEAT 
  * [CB or CC] [mod_add + mod_id(4B) + u_num] x 5
  * 
  * TAG_UPDATE
  * [BB][mod_add][mod_id(4B)][Reserved][u_num][tag_num][u_no + u_alarm + u_tag(4B)] x tag_num
  * 
  * TH_UPDATE
  * [01-05][mod_add][mod_id(4B)][th_add + th_temp(4B) + th_hum(4B)] x 6
  * 
  * NS_UPDATE
  * [01-05][mod_add][mod_id(4B)][ns_add + ns_temp(4B) + ns_hum(4B)] x 6 
  * 
  * DR_UPDATE
  * [BA][mod_add][mod_id(4B)][dr_status]
  * 
  * DEVICE_UPDATE
  * [EF][01][hub_type(2B)][hub_fm_ver(4B)][hub_ip(4B)][hub_mask(4B)][hub_gateway(4B)][hub_mac(6B)]
  * [EF][02][mod_add + fm_ver(6B)] x (until the rest bytes length < 7)
  * 
  * COLOR_SET_RESPONSE
  * [AA][hub_id(4B)][CmdResult][E1][mod_add][u_no + u_color] x n (until null)
  * 
  *
  * 
*/

export function V5008ToJson(topic, message) {

  //Convert to hex string (uppercase)
  const msg_raw = message.toString('hex').toUpperCase();
 
  //Get message ID (first byte, 2 hex chars)
  const msg_id = msg_raw.slice(0, 2);

  // Helper to read hex substrings as numbers or strings
  const readHex = (str, start, len) => str.slice(start, start + len);
  const readNum = (str, start, len) => parseInt(str.slice(start, start + len), 16);
  const readIP = (sec1, sec2, sec3, sec4) => {  return [sec1, sec2, sec3, sec4].join('.');}

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
      result.msg_format = '[BB][mod_add][mod_id(4B)][Reserved][u_num][tag_num][u_no + u_alarm + u_tag(4B)] x tag_num';
      offset = 2;
      const mod_add = readNum(msg_raw, offset, 2);
      const mod_id = readNum(msg_raw, offset + 2, 8).toString(); // Convert to decimal string
      const reserved = readHex(msg_raw, offset + 10, 2);
      const u_num = readNum(msg_raw, offset + 12, 2);
      const tag_num = readNum(msg_raw, offset + 14, 2);
      offset += 16;
      const u_sensor_data = [];
      for (let i = 0; i < tag_num && offset + 10 <= msg_raw.length; i++) {
        const u_no = readNum(msg_raw, offset, 2); // Correctly parse u_no
        const u_alarm = readNum(msg_raw, offset + 2, 2); // Correctly parse u_alarm
        const u_tag = readHex(msg_raw, offset + 4, 8); // Correctly parse u_tag
        u_sensor_data.push({ u_no, u_alarm, u_tag });
        offset += 12; // Correctly increment offset to process the next data point
      }
      result.msg_type = 'TAG_UPDATE';
      result.mod_add = mod_add;
      result.mod_id = mod_id;
      result.reserved = reserved;
      result.u_num = u_num;
      result.tag_num = tag_num;
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
      result.msg_format = '[BA][mod_add][mod_id(4B)][dr_status]';
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
        const hub_type = readNum(msg_raw, offset, 4).toString(); // Parse hub_type (2 bytes)
        const hub_fm_ver = readNum(msg_raw, offset + 4, 8).toString(); // Parse hub_fm_ver (4 bytes)
        const hub_ip = [
          readNum(msg_raw, offset + 12, 2),
          readNum(msg_raw, offset + 14, 2),
          readNum(msg_raw, offset + 16, 2),
          readNum(msg_raw, offset + 18, 2),
        ].join('.'); // Convert to IPv4 format
        const hub_mask = [
          readNum(msg_raw, offset + 20, 2),
          readNum(msg_raw, offset + 22, 2),
          readNum(msg_raw, offset + 24, 2),
          readNum(msg_raw, offset + 26, 2),
        ].join('.'); // Convert to IPv4 format
        const hub_gateway = [
          readNum(msg_raw, offset + 28, 2),
          readNum(msg_raw, offset + 30, 2),
          readNum(msg_raw, offset + 32, 2),
          readNum(msg_raw, offset + 34, 2),
        ].join('.'); // Convert to IPv4 format
        const hub_mac = [
          readHex(msg_raw, offset + 36, 2),
          readHex(msg_raw, offset + 38, 2),
          readHex(msg_raw, offset + 40, 2),
          readHex(msg_raw, offset + 42, 2),
          readHex(msg_raw, offset + 44, 2),
          readHex(msg_raw, offset + 46, 2),
        ].join(':'); // Convert to MAC address format

        result.msg_format = '[EF][01][hub_type(2B)][hub_fm_ver(4B)][hub_ip(4B)][hub_mask(4B)][hub_gateway(4B)][hub_mac(6B)]';
        result.msg_type = 'DEVICE_UPDATE';
        result.subType = 'gateway'; // 01 - gateway
        result.hub_type = hub_type;
        result.hub_fm_ver = hub_fm_ver;
        result.hub_ip = hub_ip;
        result.hub_mask = hub_mask;
        result.hub_gateway = hub_gateway;
        result.hub_mac = hub_mac;
      } else if (subType === '02') {
        result.msg_format = '[EF][02][mod_add + fm_ver(6B)] x (until the rest bytes length < 7)';
        result.msg_type = 'DEVICE_UPDATE';
        result.subType = 'module'; // 02 - module
        result.sections = [];
        while (offset + 14 <= msg_raw.length) {
          const mod_add = readNum(msg_raw, offset, 2);
          const m_fm_ver = readNum(msg_raw, offset + 2, 12).toString();
          result.sections.push({ mod_add, m_fm_ver });
          offset += 14;
        }
      }
      break;
    }

    case 'AA': {

      result.msg_format = '[AA][hub_id(4B)][CmdResult][E1][mod_add][u_no + u_color] x n (until null)';
      result.msg_type = 'COLOR_SET_RESPONSE';
      offset = 2;

      const hub_id = readNum(msg_raw, offset, 8).toString(); // Convert to decimal string
      const cmd_result = readHex(msg_raw, offset + 8, 2); // (A0 = Fail, A1 = Success)
      const cmd_code = readHex(msg_raw, offset + 10, 2); // (E1 = Color Set Command)
      const mod_add = readNum(msg_raw, offset + 12, 2); // Module address (2 bytes)

      result.hub_id = hub_id;
      result.cmd_result = cmd_result;
      result.cmd_code = cmd_code;
      result.mod_add = mod_add;

      result.sections = [];
      offset += 14; // Adjust offset to skip mod_id and cmd_result

      while (offset + 4 <= msg_raw.length) {

        const u_no = readNum(msg_raw, offset, 2);
        const u_color = readNum(msg_raw, offset + 2, 2);
        // Check for null termination (if required by format)
        //if (u_no === 0 && u_color === 0) {
        //  break;
        //}
        result.sections.push({u_no, u_color});
        offset += 4;
      }
      // Handle empty sections
      //if (result.sections.length === 0) {
      //  console.warn('No valid sections found for case AA');
      //}

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


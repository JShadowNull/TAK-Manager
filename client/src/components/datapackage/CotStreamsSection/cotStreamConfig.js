export const generateCotStreamItems = (count) => {
  const baseItems = [{
    name: "Number of CoT (Cursor on Target) streams configured",
    label: "count",
    input_type: "number",
    value: count.toString(),
    min: 1,
    max: 10,
    required: true
  }];

  for (let i = 0; i < count; i++) {
    baseItems.push(
      {
        name: `Name for TAK Server`,
        label: `description${i}`,
        input_type: "text",
        placeholder: "My-Server-Name",
        required: true
      },
      {
        name: `IP address of TAK Server`,
        label: `ipAddress${i}`,
        input_type: "text",
        placeholder: "192.168.1.20",
        required: true
      },
      {
        name: `Port of TAK Server`,
        label: `port${i}`,
        input_type: "number",
        placeholder: "8089",
        min: 1,
        max: 65535,
        required: true
      },
      {
        name: `Protocol of TAK Server`,
        label: `protocol${i}`,
        input_type: "text",
        placeholder: "ssl",
        required: true
      },
      {
        name: `CA certificate for TAK Server`,
        label: `caLocation${i}`,
        input_type: "select",
        options: [],
        placeholder: "Select CA certificate",
        isCertificateDropdown: true,
        required: true
      },
      {
        name: `Client certificate for TAK Server`,
        label: `certificateLocation${i}`,
        input_type: "select",
        options: [],
        placeholder: "Select client certificate",
        isCertificateDropdown: true,
        required: true
      },
      {
        name: `Password for the client certificate`, 
        label: `clientPassword${i}`,
        input_type: "password",
        placeholder: "atakatak",
        required: true
      },
      {
        name: `Password for the CA certificate`,
        label: `caPassword${i}`,
        input_type: "password",
        placeholder: "atakatak",
        required: true
      }
    );
  }
  return baseItems;
};
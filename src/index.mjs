import pkg from "@aws-sdk/client-ec2";
const { EC2Client, ModifyManagedPrefixListCommand, GetManagedPrefixListEntriesCommand, DescribeManagedPrefixListsCommand } = pkg;



/**
 * Lista de regiones y sus respectivas listas de prefijos administrados en AWS.
 * Este script actualiza dinámicamente las listas de prefijos con las direcciones IP
 * de los webhooks de GitHub, asegurando que las listas reflejen siempre los valores más recientes.
 *
 * Estructura del array:
 * - region: Especifica la región de AWS donde se encuentra la lista.
 * - ipv4: ID de la lista de prefijos para direcciones IPv4.
 * - ipv6: ID de la lista de prefijos para direcciones IPv6.
 *
 * Para agregar una nueva región o nuevas listas, simplemente añade un objeto con
 * la estructura adecuada dentro del array 'lists'.
 * Ejemplo:
 *    { region: 'us-east-1', ipv4: 'pl-xxxxxxxxxx', ipv6: 'pl-yyyyyyyyyy' }
 */

const lists = [
  { region: 'us-east-1', ipv4: 'pl-xxxxxxxxxx', ipv6: 'pl-yyyyyyyyyy' }
];







export const handler = async (event) => {
  try {
    const { hooks } = await getGithubIPs();
    const ipv4List = hooks.filter(ip => ip.includes('.'));
    const ipv6List = hooks.filter(ip => ip.includes(':'));

    for (const list of lists) {
      await updateManagedPrefixListEntries(list.region, list.ipv4, ipv4List);
      await updateManagedPrefixListEntries(list.region, list.ipv6, ipv6List);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "AWS Prefix Lists updated successfully." }),
    };
  } catch (error) {
    console.error("Error updating AWS Prefix Lists:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};

async function updateManagedPrefixListEntries(region, prefixListId, ips) {
  const client = new EC2Client({ region });
  
  const describeResponse = await client.send(new DescribeManagedPrefixListsCommand({ PrefixListIds: [prefixListId] }));
  const prefixList = describeResponse.PrefixLists[0];
  const currentVersion = prefixList.Version;
  const maxEntries = prefixList.MaxEntries;

  if (ips.length > maxEntries) {
    await resizePrefixList(client, prefixListId, ips.length);
    await waitForPrefixListModification(client, prefixListId);
  }
  
  const entriesResponse = await client.send(new GetManagedPrefixListEntriesCommand({ PrefixListId: prefixListId }));
  const currentEntries = entriesResponse.Entries.map(entry => entry.Cidr);

  const entriesToAdd = ips.filter(ip => !currentEntries.includes(ip)).map(ip => ({ Cidr: ip, Description: "GitHub Webhook IP" }));
  const entriesToRemove = currentEntries.filter(ip => !ips.includes(ip)).map(ip => ({ Cidr: ip }));

  if (entriesToAdd.length === 0 && entriesToRemove.length === 0) {
    console.log(`No hay cambios en la lista ${prefixListId}`);
    return;
  }

  const params = {
    PrefixListId: prefixListId,
    CurrentVersion: currentVersion,
    AddEntries: entriesToAdd,
    RemoveEntries: entriesToRemove,
  };

  const modifyCommand = new ModifyManagedPrefixListCommand(params);
  await client.send(modifyCommand);
  console.log(`Lista ${prefixListId} actualizada con éxito`);
}

async function resizePrefixList(client, prefixListId, newSize) {
  console.log(`Aumentando el tamaño de la lista ${prefixListId} a ${newSize} entradas`);
  const params = {
    PrefixListId: prefixListId,
    MaxEntries: newSize,
  };
  const modifyCommand = new ModifyManagedPrefixListCommand(params);
  await client.send(modifyCommand);
}

async function waitForPrefixListModification(client, prefixListId) {
  let state = '';
  while (state !== 'modify-complete') {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const describeResponse = await client.send(new DescribeManagedPrefixListsCommand({ PrefixListIds: [prefixListId] }));
    state = describeResponse.PrefixLists[0].State;
    console.log(`Estado actual de la lista ${prefixListId}: ${state}`);
  }
}

async function getGithubIPs() {
  try {
    // https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-githubs-ip-addresses
    const response = await fetch('https://api.github.com/meta');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error al obtener las IPs de GitHub:", error);
    return { hooks: [] };
  }
}

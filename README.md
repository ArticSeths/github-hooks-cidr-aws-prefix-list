# Actualización automática de listas de prefijos en AWS con GitHub Webhooks

Este repositorio contiene una función AWS Lambda que actualiza automáticamente listas de prefijos administradas en AWS con las direcciones IP de los webhooks de GitHub.

## 🚀 Pasos para la configuración

### 1️⃣ Crear listas de prefijos administradas en AWS

Debes crear dos listas de prefijos en AWS: una para direcciones IPv4 y otra para IPv6 en la región donde desees.

1. Ve a la consola de AWS VPC.
2. En el menú lateral, selecciona **"Managed Prefix Lists"**.
3. Haz clic en **"Create prefix list"**.
4. Configura la lista de la siguiente manera:
   - **Nombre**: GitHub-Webhooks-IPv4
   - **Max entries**: Un valor suficientemente alto para contener las direcciones IP de GitHub. (El propio script escala este valor si lo requiere, osea que puedes poner de valor 1)
   - **CIDR family**: **IPv4**
5. Repite los pasos anteriores para la lista de **IPv6**.
6. Guarda los IDs de las listas creadas, los necesitarás más adelante.

### 2️⃣ Configurar una función Lambda en AWS

1. Ve a la consola de **AWS Lambda**.
2. Crea una nueva función Lambda con las siguientes configuraciones:
   - **Nombre**: `SyncPrefixListsGithubHooks`
   - **Runtime**: Node.js 22
   - **Tipo de ejecución**: Modo de ejecución basado en roles (IAM Role)
3. Sube el código del script `index.mjs` a la función Lambda o implementa directamente desde un repositorio Git.
4. Asegúrate de que el código tenga los IDs correctos de las listas de prefijos creadas en el paso anterior.

### 3️⃣ Configurar permisos en IAM

El rol de ejecución de la Lambda necesita permisos para modificar las listas de prefijos. Añade la siguiente política al rol de la función Lambda:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "ec2:GetManagedPrefixListEntries",
                "ec2:ModifyManagedPrefixList",
                "ec2:GetManagedPrefixListAssociations",
                "ec2:RestoreManagedPrefixListVersion"
            ],
            "Resource": [
                "arn:aws:ec2:{REGION}:{ACCOUNT}:prefix-list/{PREFIX_LIST_ID_IPV4}",
                "arn:aws:ec2:{REGION}:{ACCOUNT}:prefix-list/{PREFIX_LIST_ID_IPV6}",
            ]
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": "ec2:DescribeManagedPrefixLists",
            "Resource": "*"
        }
    ]
}
```

### 4️⃣ Configurar el trigger de ejecución

1. En la consola de AWS Lambda, ve a tu función y selecciona **"Add Trigger"**.
2. Selecciona **CloudWatch Events** o **EventBridge**.
3. Configura un evento programado para que la función se ejecute periódicamente (por ejemplo, 1 vez al día).
4. Guarda los cambios.

### 5️⃣ Verificación y prueba

- Ejecuta la función manualmente desde la consola de Lambda.
- Revisa los logs en **CloudWatch Logs** para verificar si la actualización de las listas de prefijos se realizó correctamente.
- Confirma que las direcciones IP de GitHub aparecen en la lista de prefijos en la consola de VPC.

## 🔥 Conclusión

Con esta configuración, la función Lambda actualizará automáticamente las listas de prefijos en AWS con las direcciones IP de los webhooks de GitHub. Esto garantiza que solo las IPs autorizadas puedan acceder a servicios protegidos por estas listas.

Si necesitas modificar los IDs de las listas o agregar nuevas regiones, edita la variable `lists` en el código fuente de la Lambda. También acuerdate de actualizar los permisos del rol de ejecución de la función lambda.
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"

interface Contact {
  TelefoneClientes: string
  NomeDaEmpresa: string
  last_message_time: string
  instance_name: string
  total_messages: number
}

export function ContactsTable({ instanceId }: { instanceId: string }) {
  const { data: contacts, isLoading } = useQuery({
    queryKey: ['instance-contacts', instanceId],
    queryFn: async () => {
      console.log('Fetching contacts for instance:', instanceId)
      const { data, error } = await supabase
        .from('Users_clientes')
        .select(`
          TelefoneClientes,
          NomeDaEmpresa,
          last_message_time,
          evolution_instances!inner (
            name
          )
        `)
        .eq('NomeDaEmpresa', instanceId)
        .order('last_message_time', { ascending: false })

      if (error) {
        console.error('Error fetching contacts:', error)
        throw error
      }

      // Transform data to match Contact interface
      return data.map(contact => ({
        TelefoneClientes: contact.TelefoneClientes,
        NomeDaEmpresa: contact.NomeDaEmpresa,
        last_message_time: contact.last_message_time,
        instance_name: contact.evolution_instances.name,
        total_messages: 0 // We'll implement message count in a future update
      }))
    }
  })

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Telefone</TableHead>
            <TableHead>Última Mensagem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts?.map((contact) => (
            <TableRow key={contact.TelefoneClientes}>
              <TableCell>{contact.TelefoneClientes}</TableCell>
              <TableCell>
                {format(new Date(contact.last_message_time), 'dd/MM/yyyy HH:mm')}
              </TableCell>
            </TableRow>
          ))}
          {contacts?.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                Nenhum contato encontrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
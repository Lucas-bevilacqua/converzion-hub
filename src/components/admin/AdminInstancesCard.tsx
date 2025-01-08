import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2 } from "lucide-react";

export function AdminInstancesCard() {
  const { data: instances, isLoading } = useQuery({
    queryKey: ['admin-instances'],
    queryFn: async () => {
      console.log('Fetching instances for admin panel');
      const { data, error } = await supabase
        .from('evolution_instances')
        .select(`
          *,
          profiles (
            full_name
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching instances:', error);
        throw error;
      }
      return data;
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Instâncias WhatsApp
        </CardTitle>
        <CardDescription>
          Gerenciar instâncias do WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances?.map((instance) => (
                  <TableRow key={instance.id}>
                    <TableCell>{instance.name}</TableCell>
                    <TableCell>{instance.profiles?.full_name}</TableCell>
                    <TableCell>{instance.phone_number}</TableCell>
                    <TableCell>
                      <Badge className={
                        instance.connection_status === 'connected' 
                          ? 'bg-green-500' 
                          : 'bg-yellow-500'
                      }>
                        {instance.connection_status === 'connected' 
                          ? 'Conectado' 
                          : 'Desconectado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(instance.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
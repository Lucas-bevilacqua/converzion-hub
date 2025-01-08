import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2 } from "lucide-react";

export function AdminSubscriptionsCard() {
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      console.log('Fetching subscriptions for admin panel');
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          profiles (
            full_name
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching subscriptions:', error);
        throw error;
      }
      return data;
    }
  });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'canceled':
        return 'bg-red-500';
      case 'past_due':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          Assinaturas
        </CardTitle>
        <CardDescription>
          Gerenciar assinaturas dos usuários
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
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Válido até</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions?.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>{subscription.profiles?.full_name}</TableCell>
                    <TableCell>
                      {subscription.plan_id?.includes('professional') 
                        ? 'Profissional' 
                        : 'Inicial'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(subscription.status)}>
                        {subscription.status === 'active' && 'Ativo'}
                        {subscription.status === 'canceled' && 'Cancelado'}
                        {subscription.status === 'past_due' && 'Atrasado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {subscription.current_period_end 
                        ? new Date(subscription.current_period_end).toLocaleDateString()
                        : '-'}
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
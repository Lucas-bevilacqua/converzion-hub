import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageSquare, Loader2, Plus } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useState } from "react"

export function InstancesCard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [newInstance, setNewInstance] = useState({
    name: "",
    api_url: "",
    api_key: ""
  })

  const { data: instances, isLoading } = useQuery({
    queryKey: ['instances', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('user_id', user?.id)
      
      if (error) throw error
      return data
    },
    enabled: !!user?.id
  })

  const addMutation = useMutation({
    mutationFn: async (instance: typeof newInstance) => {
      const { error } = await supabase
        .from('evolution_instances')
        .insert([{ ...instance, user_id: user?.id }])
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      setNewInstance({ name: "", api_url: "", api_key: "" })
    }
  })

  const handleAdd = () => {
    addMutation.mutate(newInstance)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Instâncias Evolution API
        </CardTitle>
        <CardDescription>
          Gerencie suas instâncias do WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {instances?.map((instance) => (
                <div 
                  key={instance.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{instance.name}</p>
                    <p className="text-sm text-muted-foreground">{instance.api_url}</p>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                </div>
              ))}
            </div>
            
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Adicionar Nova Instância</h4>
              <div className="space-y-2">
                <Input
                  placeholder="Nome da Instância"
                  value={newInstance.name}
                  onChange={(e) => setNewInstance(prev => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  placeholder="URL da API"
                  value={newInstance.api_url}
                  onChange={(e) => setNewInstance(prev => ({ ...prev, api_url: e.target.value }))}
                />
                <Input
                  placeholder="Chave da API"
                  type="password"
                  value={newInstance.api_key}
                  onChange={(e) => setNewInstance(prev => ({ ...prev, api_key: e.target.value }))}
                />
                <Button 
                  onClick={handleAdd}
                  disabled={addMutation.isPending}
                  className="w-full"
                >
                  {addMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Instância
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
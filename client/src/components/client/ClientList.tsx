import { useState, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, X, User, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { ClientData } from '@/lib/types';
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Edit } from "lucide-react";

interface ClientListProps {
  clients: ClientData[];
  onSelectClient: (client: ClientData) => void;
  onAddNew: () => void;
  selectedClientId?: string;
}

type ClientStatus = 'all' | 'active' | 'inactive';

export function ClientList({ clients, onSelectClient, onAddNew, selectedClientId }: ClientListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Helpers to support both flattened and nested user data
  const getFirstName = (c: ClientData) => (c as any).firstName ?? (c as any).user?.firstName ?? '';
  const getLastName = (c: ClientData) => (c as any).lastName ?? (c as any).user?.lastName ?? '';
  const getEmail = (c: ClientData) => (c as any).email ?? (c as any).user?.email ?? '';
  const getCreatedAt = (c: ClientData) => (c as any).createdAt ?? (c as any).user?.createdAt ?? undefined;

  const filteredClients = useMemo(() => {
    console.log('[ClientList] Debug:', {
      totalClients: clients.length,
      searchTerm,
      statusFilter,
      firstClientSample: clients[0] ? {
        firstName: getFirstName(clients[0]),
        lastName: getLastName(clients[0]),
        email: getEmail(clients[0]),
        isActive: clients[0].isActive
      } : null
    });
    
    const filtered = clients.filter(client => {
      // Search filter
      const fn = String(getFirstName(client)).toLowerCase();
      const ln = String(getLastName(client)).toLowerCase();
      const em = String(getEmail(client)).toLowerCase();
      const q = searchTerm.toLowerCase();
      const matchesSearch = fn.includes(q) || ln.includes(q) || em.includes(q);
      
      // Status filter
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && !!client.isActive) ||
        (statusFilter === 'inactive' && !client.isActive);
      
      const passes = matchesSearch && matchesStatus;
      if (!passes) {
        console.log('[ClientList] Filtered out client:', {
          name: `${fn} ${ln}`,
          email: em,
          matchesSearch,
          matchesStatus,
          statusFilter,
          isActive: client.isActive
        });
      }
      
      return passes;
    });
    
    console.log('[ClientList] Filtered result:', filtered.length, 'of', clients.length);
    return filtered;
  }, [clients, searchTerm, statusFilter]);

  const getStatusBadge = (client: ClientData) => {
    return client.isActive ? (
      <Badge variant="outline" className="border-green-500 text-green-500">
        <CheckCircle className="h-3 w-3 mr-1" /> Active
      </Badge>
    ) : (
      <Badge variant="outline" className="border-rose-500 text-rose-500">
        <AlertCircle className="h-3 w-3 mr-1" /> Inactive
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button 
          variant={showFilters ? 'default' : 'outline'} 
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          {showFilters ? 'Hide Filters' : 'Filters'}
        </Button>
        <Button onClick={onAddNew} className="gap-2">
          <User className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {showFilters && (
        <div className="bg-muted/50 p-4 rounded-lg mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm font-medium">Status:</span>
            {['all', 'active', 'inactive'].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status as ClientStatus)}
                className="capitalize"
              >
                {status === 'all' ? 'All Clients' : status}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filteredClients.length > 0 ? (
          filteredClients.map((client) => (
            <div
              key={client.id}
              className={`cursor-pointer rounded-lg border ${selectedClientId === client.id ? 'border-thrst-green/50' : 'border-white/10'} bg-card/50 p-4 hover:border-thrst-green/30 transition-all duration-200 relative overflow-hidden group`}
              onClick={() => onSelectClient(client)}
            >
              <div
                className="absolute inset-0 thrst-gradient opacity-0 group-hover:opacity-10 transition-opacity duration-300"
              ></div>
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 thrst-gradient rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">
                      {getFirstName(client)?.charAt(0) || 'C'}
                      {getLastName(client)?.charAt(0) || ''}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-white">
                      {getFirstName(client)} {getLastName(client)}
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {getEmail(client)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-thrst-green hover:bg-thrst-green/20 h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Add messaging logic here if needed
                      onSelectClient(client);
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-thrst-green hover:bg-thrst-green/20 h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClient(client);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div
                className={`absolute bottom-0 left-0 w-full h-0.5 ${selectedClientId === client.id ? 'bg-thrst-green' : 'bg-transparent'} group-hover:bg-thrst-green/50 transition-all duration-200`}
                style={{ boxShadow: selectedClientId === client.id ? '0px -2px 8px rgba(0, 255, 171, 0.5)' : 'none' }}
              ></div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No clients found matching your criteria</p>
            <Button 
              variant="ghost" 
              className="mt-2 text-primary"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>
      <div
        className="cursor-pointer rounded-lg border border-dashed border-white/20 bg-card/30 p-6 hover:border-thrst-green/50 hover:bg-card/40 transition-all duration-200 flex items-center justify-center relative overflow-hidden group"
        onClick={onAddNew}
      >
        <div
          className="absolute inset-0 thrst-gradient opacity-0 group-hover:opacity-10 transition-opacity duration-300"
        ></div>
        <div className="relative z-10 text-center">
          <div className="w-10 h-10 thrst-gradient rounded-full flex items-center justify-center mx-auto mb-2 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity duration-200">
            <span className="text-white font-bold text-lg">+</span>
          </div>
          <span className="text-thrst-green font-medium">Add New Client</span>
        </div>
      </div>
    </div>
  );
}

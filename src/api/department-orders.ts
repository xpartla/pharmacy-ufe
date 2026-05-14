export type DepartmentOrderStatus =
    | 'created'
    | 'processing'
    | 'fulfilled'
    | 'canceled'
    | 'archived';

export interface DepartmentOrderItem {
    id?: string;
    productId?: string;
    productName: string;
    requestedQty: number;
    issuedQty: number;
}

export interface DepartmentOrder {
    id?: string;
    departmentName: string;
    note?: string;
    status: DepartmentOrderStatus;
    createdAt?: string;
    updatedAt?: string;
    items: DepartmentOrderItem[];
}

const headers = {
    'Content-Type': 'application/json',
};

async function parse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || response.statusText || 'Request failed');
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return (await response.json()) as T;
}

export async function fetchDepartmentOrders(
    apiBase: string,
    pharmacyId: string
): Promise<DepartmentOrder[]> {
    const response = await fetch(`${apiBase}/orders/${encodeURIComponent(pharmacyId)}/items`);
    return parse<DepartmentOrder[]>(response);
}

export async function fetchDepartmentOrder(
    apiBase: string,
    pharmacyId: string,
    orderId: string
): Promise<DepartmentOrder> {
    const response = await fetch(
        `${apiBase}/orders/${encodeURIComponent(pharmacyId)}/items/${encodeURIComponent(orderId)}`
    );
    return parse<DepartmentOrder>(response);
}

export async function createDepartmentOrder(
    apiBase: string,
    pharmacyId: string,
    order: DepartmentOrder
): Promise<DepartmentOrder> {
    const response = await fetch(`${apiBase}/orders/${encodeURIComponent(pharmacyId)}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify(order),
    });
    return parse<DepartmentOrder>(response);
}

export async function updateDepartmentOrder(
    apiBase: string,
    pharmacyId: string,
    orderId: string,
    order: DepartmentOrder
): Promise<DepartmentOrder> {
    const response = await fetch(
        `${apiBase}/orders/${encodeURIComponent(pharmacyId)}/items/${encodeURIComponent(orderId)}`,
        {
            method: 'PUT',
            headers,
            body: JSON.stringify(order),
        }
    );
    return parse<DepartmentOrder>(response);
}

export async function deleteDepartmentOrder(
    apiBase: string,
    pharmacyId: string,
    orderId: string
): Promise<void> {
    const response = await fetch(
        `${apiBase}/orders/${encodeURIComponent(pharmacyId)}/items/${encodeURIComponent(orderId)}`,
        {
            method: 'DELETE',
            headers,
        }
    );
    return parse<void>(response);
}

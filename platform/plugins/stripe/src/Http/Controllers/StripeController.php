<?php

namespace Botble\Stripe\Http\Controllers;

use Botble\Base\Http\Responses\BaseHttpResponse;
use Botble\Payment\Enums\PaymentStatusEnum;
use Botble\Payment\Supports\PaymentHelper;
use Botble\Stripe\Http\Requests\StripePaymentCallbackRequest;
use Botble\Stripe\Services\Gateways\StripePaymentService;
use Exception;
use Illuminate\Routing\Controller;
use Stripe\Checkout\Session;
use Stripe\PaymentIntent;

class StripeController extends Controller
{
    /**
     * @param StripePaymentCallbackRequest $request
     * @param StripePaymentService $stripePaymentService
     * @param BaseHttpResponse $response
     * @return BaseHttpResponse
     */
    public function success(StripePaymentCallbackRequest $request, StripePaymentService $stripePaymentService, BaseHttpResponse $response)
    {
        try {
            $stripePaymentService->setClient();

            $session = Session::retrieve($request->input('session_id'));

            if ($session->payment_status == 'paid') {
                $metadata = $session->metadata->toArray();

                $orderIds = json_decode($metadata['order_id'], true);

                $charge = PaymentIntent::retrieve($session->payment_intent);

                do_action(PAYMENT_ACTION_PAYMENT_PROCESSED, [
                    'amount'          => $metadata['amount'],
                    'currency'        => strtoupper($session->currency),
                    'charge_id'       => $charge->charges->first()->id,
                    'order_id'        => $orderIds,
                    'customer_id'     => $metadata['customer_id'],
                    'customer_type'   => $metadata['customer_type'],
                    'payment_channel' => STRIPE_PAYMENT_METHOD_NAME,
                    'status'          => PaymentStatusEnum::COMPLETED,
                ]);

                return $response
                    ->setNextUrl(url($metadata['callback_url'] . '?charge_id=' . $session->id))
                    ->setMessage(__('Checkout successfully!'));
            }

            return $response
                ->setError()
                ->setNextUrl(PaymentHelper::getCancelURL())
                ->setMessage(__('Payment failed!'));
        } catch (Exception $exception) {
            return $response
                ->setError()
                ->setNextUrl(PaymentHelper::getCancelURL())
                ->withInput()
                ->setMessage($exception->getMessage() ?: __('Payment failed!'));
        }
    }

    /**
     * @param BaseHttpResponse $response
     * @return BaseHttpResponse
     */
    public function error(BaseHttpResponse $response)
    {
        return $response
            ->setError()
            ->setNextUrl(PaymentHelper::getCancelURL())
            ->withInput()
            ->setMessage(__('Payment failed!'));
    }
}
